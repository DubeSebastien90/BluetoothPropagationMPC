import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { decodeIdentityFromQR } from '../contracts/IdentityContract';
import { useApp } from '../state/AppContext';

export function ScanScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) return null;

  if (!permission.granted) {
    requestPermission();
    return (
      <View style={s.center}>
        <Text style={s.msg}>Camera permission required to scan QR codes.</Text>
      </View>
    );
  }

  const handleScan = ({ data }) => {
    if (scanned) return;
    setScanned(true);

    const contact = decodeIdentityFromQR(data);
    if (!contact) {
      Alert.alert('Invalid QR', 'This QR code is not a valid contact.', [
        { text: 'Try again', onPress: () => setScanned(false) },
      ]);
      return;
    }

    // Don't add yourself
    if (contact.pubkey === state.identity?.pubkey) {
      Alert.alert('That\'s you!', 'You scanned your own QR code.', [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
      return;
    }

    // Register their key in crypto layer if available
    state.router?.crypto?.registerPeerKey(contact.pubkey, contact.nickname);

    dispatch({ type: 'ADD_CONTACT', payload: contact });

    Alert.alert(
      'Contact added',
      `${contact.nickname} has been added to your contacts.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <View style={s.container}>
      <CameraView
        style={s.camera}
        onBarcodeScanned={handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <View style={s.overlay}>
        <View style={s.frame} />
      </View>
      <Text style={s.hint}>Point at someone's Profile QR code</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, backgroundColor: '#0a0a1a',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  msg:    { color: '#fff', textAlign: 'center', fontSize: 15 },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  frame: {
    width: 220, height: 220,
    borderWidth: 2, borderColor: '#2563eb', borderRadius: 12,
  },
  hint: {
    color: '#fff', textAlign: 'center',
    padding: 16, backgroundColor: '#0a0a1a',
    fontSize: 14,
  },
});
