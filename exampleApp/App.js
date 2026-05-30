import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  PermissionsAndroid, Platform, Alert, NativeModules,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { StatusBar } from 'expo-status-bar';

// ─── Constants ────────────────────────────────────────────────────────────────
// react-native-ble-plx normalises UUIDs to uppercase
const SERVICE_UUID = '12345678-1234-1234-1234-123456789ABC';
const CHAR_UUID    = 'ABCDEFAB-1234-1234-1234-ABCDEFABCDEF';
const PING_B64     = btoa('PING');           // "UElORw=="
const ADV_TIMEOUT  = 10_000;                 // stop advertising after 10 s

const { BlePeripheral } = NativeModules;
const bleManager = new BleManager();

// ─── Permissions ──────────────────────────────────────────────────────────────
async function requestAndroidPermissions() {
  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);
  return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [pong, setPong]       = useState(null);   // null | "PONG from <id>"
  const [advertising, setAdv] = useState(false);
  const [scanning, setScanning] = useState(false);
  const connecting            = useRef(new Set()); // device IDs in-flight
  const pongTimer             = useRef(null);
  const advTimer              = useRef(null);

  // ── Start BLE central (scanning) once BT is on ────────────────────────────
  useEffect(() => {
    const sub = bleManager.onStateChange(state => {
      if (state === 'PoweredOn') {
        sub.remove();
        initPermissionsAndScan();
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
        Alert.alert(
          'Permissions required',
          'Grant all Bluetooth and Location permissions then restart the app.'
        );
        return;
      }
    }
    startScanning();
  }

  // ── Central: scan → connect → write → show PONG ───────────────────────────
  const startScanning = useCallback(() => {
    setScanning(true);
    bleManager.startDeviceScan(
      [SERVICE_UUID],
      { allowDuplicates: true },
      (error, device) => {
        if (error || !device) return;
        connectAndPing(device);
      }
    );
  }, []);

  async function connectAndPing(device) {
    if (connecting.current.has(device.id)) return;
    connecting.current.add(device.id);
    try {
      const connected = await device.connect({ timeout: 5000 });
      await connected.discoverAllServicesAndCharacteristics();
      await connected.writeCharacteristicWithResponseForService(
        SERVICE_UUID, CHAR_UUID, PING_B64
      );
      showPong(device.id);
      await connected.cancelConnection();
    } catch {
      // timeout / already connecting / device went away — ignore
    } finally {
      connecting.current.delete(device.id);
    }
  }

  function showPong(deviceId) {
    // Shorten deviceId: last 5 chars (MAC tail on Android, UUID tail on iOS)
    const short = deviceId.slice(-5).toUpperCase();
    setPong(`PONG from …${short}`);
    clearTimeout(pongTimer.current);
    pongTimer.current = setTimeout(() => setPong(null), 4000);
  }

  // ── Peripheral: advertise GATT service so others can find & write to us ───
  async function handlePing() {
    if (advertising) return;
    setAdv(true);
    try {
      await BlePeripheral.startPeripheral();
      advTimer.current = setTimeout(async () => {
        await BlePeripheral.stopPeripheral();
        setAdv(false);
      }, ADV_TIMEOUT);
    } catch (e) {
      Alert.alert('BLE Peripheral error', e?.message ?? String(e));
      setAdv(false);
    }
  }

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* PONG indicator — invisible (opacity 0) when no pong, so layout is stable */}
      <Text style={[styles.pong, !pong && styles.hidden]}>
        {pong ?? 'PONG from …XXXXX'}
      </Text>

      <TouchableOpacity
        style={[styles.button, advertising && styles.buttonBusy]}
        onPress={handlePing}
        activeOpacity={0.75}
        disabled={advertising}
      >
        <Text style={styles.buttonText}>{advertising ? 'PINGING…' : 'PING'}</Text>
      </TouchableOpacity>

      <Text style={styles.status}>
        {scanning ? '📡 scanning' : '⏳ waiting for BT'}
      </Text>

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  pong: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#00e5ff',
    letterSpacing: 2,
  },
  hidden: {
    opacity: 0,
  },
  button: {
    backgroundColor: '#6200ee',
    paddingVertical: 24,
    paddingHorizontal: 64,
    borderRadius: 16,
    minWidth: 180,
    alignItems: 'center',
  },
  buttonBusy: {
    backgroundColor: '#333',
  },
  buttonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  status: {
    color: '#555',
    fontSize: 13,
  },
});
