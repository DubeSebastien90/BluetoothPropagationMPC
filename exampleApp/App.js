import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  PermissionsAndroid, Platform, Alert, NativeModules,
  KeyboardAvoidingView, Modal,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { StatusBar } from 'expo-status-bar';
import { requireNativeModule } from 'expo-modules-core';
import QRCode from 'react-native-qrcode-svg';

// ─── Constants ────────────────────────────────────────────────────────────────
const SERVICE_UUID = '12345678-1234-1234-1234-123456789ABC';
const CHAR_UUID    = 'ABCDEFAB-1234-1234-1234-ABCDEFABCDEF';
const ADV_TIMEOUT  = 10_000;

// iOS: Expo Module (Swift, new arch native)
// Android: legacy bridge module (Kotlin, works fine with new arch interop)
const BlePeripheral = Platform.OS === 'ios'
  ? requireNativeModule('BlePeripheral')
  : NativeModules.BlePeripheral;

const bleManager = new BleManager();

// ─── Permissions ──────────────────────────────────────────────────────────────
async function requestAndroidPermissions() {
  if (Platform.Version >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
  } else {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [message, setMessage]         = useState('');        // text input value
  const [received, setReceived]       = useState(null);      // received message to display
  const [sending, setSending]         = useState(false);     // advertising in progress
  const [scanning, setScanning]       = useState(false);
  const [error, setError]             = useState(null);
  const [qrVisible, setQrVisible]     = useState(false);
  const [qrInput, setQrInput]         = useState('');
  const [qrValue, setQrValue]         = useState(null);
  const connecting                    = useRef(new Set());
  const receivedTimer                 = useRef(null);
  const advTimer                      = useRef(null);
  const errorTimer                    = useRef(null);

  function showError(msg) {
    setError(msg);
    clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 5000);
  }

  function showReceived(text, fromId) {
    const short = fromId.slice(-5).toUpperCase();
    setReceived({ text, from: `…${short}` });
    clearTimeout(receivedTimer.current);
    receivedTimer.current = setTimeout(() => setReceived(null), 6000);
  }

  // ── BLE state + permissions + scan ────────────────────────────────────────
  useEffect(() => {
    const sub = bleManager.onStateChange(state => {
      if (state === 'PoweredOn') {
        sub.remove();
        initPermissionsAndScan();
      } else if (state === 'PoweredOff') {
        setScanning(false);
        showError('Bluetooth is off — turn it on to use this app');
      } else if (state === 'Unauthorized') {
        showError('Bluetooth permission denied');
      }
    }, true);
    return () => {
      sub.remove();
      bleManager.stopDeviceScan();
      bleManager.destroy();
      BlePeripheral?.stopPeripheral?.().catch(() => {});
    };
  }, []);

  async function initPermissionsAndScan() {
    if (Platform.OS === 'android') {
      const granted = await requestAndroidPermissions();
      if (!granted) {
        Alert.alert('Permissions required', 'Grant Bluetooth and Location permissions then restart the app.');
        return;
      }
    }
    startScanning();
  }

  // ── Central: scan → connect → READ message → display ─────────────────────
  const startScanning = useCallback(() => {
    setScanning(true);
    bleManager.startDeviceScan(
      [SERVICE_UUID],
      { allowDuplicates: true },
      (err, device) => {
        if (err) { showError(`Scan error: ${err.message}`); return; }
        if (!device) return;
        connectAndRead(device);
      }
    );
  }, []);

  async function connectAndRead(device) {
    if (connecting.current.has(device.id)) return;
    connecting.current.add(device.id);
    try {
      const connected = await device.connect({ timeout: 5000 });
      await connected.discoverAllServicesAndCharacteristics();
      const char = await connected.readCharacteristicForService(SERVICE_UUID, CHAR_UUID);
      const text = atob(char.value);   // decode base64 → original message string
      showReceived(text, device.id);
      await connected.cancelConnection();
    } catch (e) {
      const msg = e?.message ?? String(e);
      if (!msg.includes('already') && !msg.includes('cancelled')) {
        showError(`Connect failed (${device.id.slice(-5)}): ${msg}`);
      }
    } finally {
      connecting.current.delete(device.id);
    }
  }

  // ── Peripheral: load message into readable characteristic + advertise ──────
  async function handleSend() {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await BlePeripheral.startPeripheral(text);   // atomic: message + start in one call
      advTimer.current = setTimeout(async () => {
        await BlePeripheral.stopPeripheral();
        setSending(false);
      }, ADV_TIMEOUT);
    } catch (e) {
      showError(`Send failed: ${e?.message ?? String(e)}`);
      setSending(false);
    }
  }

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />

      {/* App bar */}
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>BLE Messenger</Text>
        <TouchableOpacity
          style={styles.qrButton}
          onPress={() => { setQrInput(''); setQrValue(null); setQrVisible(true); }}
          activeOpacity={0.75}
        >
          <Text style={styles.qrButtonText}>QR</Text>
        </TouchableOpacity>
      </View>

      {/* QR code modal */}
      <Modal
        visible={qrVisible}
        animationType="slide"
        onRequestClose={() => setQrVisible(false)}
      >
        <View style={styles.qrModal}>
          <StatusBar style="light" />

          {/* Modal header */}
          <View style={styles.qrModalHeader}>
            <TouchableOpacity onPress={() => setQrVisible(false)} activeOpacity={0.75}>
              <Text style={styles.qrBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.qrModalTitle}>Generate QR Code</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Input */}
          <TextInput
            style={styles.qrInput}
            value={qrInput}
            onChangeText={setQrInput}
            placeholder="Enter text or URL…"
            placeholderTextColor="#444"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Generate button */}
          <TouchableOpacity
            style={[styles.button, !qrInput.trim() && styles.buttonDisabled]}
            onPress={() => setQrValue(qrInput.trim())}
            activeOpacity={0.75}
            disabled={!qrInput.trim()}
          >
            <Text style={styles.buttonText}>GENERATE</Text>
          </TouchableOpacity>

          {/* QR code */}
          {qrValue ? (
            <View style={styles.qrCodeBox}>
              <QRCode value={qrValue} size={220} backgroundColor="#fff" />
            </View>
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrPlaceholderText}>QR code will appear here</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Received message */}
      <View style={styles.receivedBox}>
        {received ? (
          <>
            <Text style={styles.receivedText}>{received.text}</Text>
            <Text style={styles.receivedFrom}>from {received.from}</Text>
          </>
        ) : (
          <Text style={styles.receivedPlaceholder}>waiting for messages…</Text>
        )}
      </View>

      {/* Text input */}
      <TextInput
        style={styles.input}
        value={message}
        onChangeText={setMessage}
        placeholder="Type a message…"
        placeholderTextColor="#444"
        returnKeyType="send"
        onSubmitEditing={handleSend}
        editable={!sending}
      />

      {/* Send button */}
      <TouchableOpacity
        style={[styles.button, (sending || !message.trim()) && styles.buttonDisabled]}
        onPress={handleSend}
        activeOpacity={0.75}
        disabled={sending || !message.trim()}
      >
        <Text style={styles.buttonText}>
          {sending ? 'SENDING…' : 'SEND'}
        </Text>
      </TouchableOpacity>

      {/* Status + errors */}
      <Text style={styles.status}>
        {scanning ? '📡 scanning' : '⏳ waiting for BT'}
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
  },
  appBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingBottom: 12,
    backgroundColor: '#0a0a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
    zIndex: 10,
  },
  appBarTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  qrButton: {
    backgroundColor: '#6200ee',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  qrButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  qrModal: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 24,
  },
  qrModalHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  qrBackText: {
    color: '#6200ee',
    fontSize: 16,
    fontWeight: '600',
    width: 60,
  },
  qrModalTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  qrInput: {
    width: '100%',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
  },
  qrCodeBox: {
    marginTop: 8,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  qrPlaceholder: {
    marginTop: 8,
    width: 260,
    height: 260,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholderText: {
    color: '#333',
    fontSize: 14,
  },
  receivedBox: {
    width: '100%',
    minHeight: 100,
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  receivedText: {
    color: '#00e5ff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  receivedFrom: {
    color: '#555',
    fontSize: 13,
    marginTop: 8,
  },
  receivedPlaceholder: {
    color: '#333',
    fontSize: 14,
  },
  input: {
    width: '100%',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#6200ee',
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 14,
    minWidth: 180,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#2a2a2a',
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  status: {
    color: '#555',
    fontSize: 13,
  },
  error: {
    color: '#ff5252',
    fontSize: 13,
    textAlign: 'center',
  },
});
