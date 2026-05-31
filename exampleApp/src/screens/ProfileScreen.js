import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { encodeIdentityForQR } from '../contracts/IdentityContract';
import { useApp } from '../state/AppContext';

export function ProfileScreen({ onDeleteAccount }) {
  const { state } = useApp();
  const { identity } = state;

  if (!identity) return null;

  const qrValue = encodeIdentityForQR(identity);

  const confirmDelete = () => {
    Alert.alert(
      'Delete account',
      'This will wipe your identity, keypair, and all contacts from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDeleteAccount },
      ]
    );
  };

  return (
    <View style={s.container}>
      <Text style={s.name}>{identity.nickname}</Text>
      <Text style={s.sub}>Scan this to add me as a contact</Text>
      <View style={s.qrBox}>
        <QRCode
          value={qrValue}
          size={220}
          backgroundColor="#fff"
          color="#000"
        />
      </View>
      <Text style={s.id} numberOfLines={2} ellipsizeMode="middle">
        ID: {identity.pubkey}
      </Text>
      <TouchableOpacity style={s.deleteBtn} onPress={confirmDelete}>
        <Text style={s.deleteBtnText}>Delete Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0a0a1a',
    alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16,
  },
  name: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  sub:  { color: '#555', fontSize: 14 },
  qrBox: {
    backgroundColor: '#fff', padding: 16, borderRadius: 16,
  },
  id: {
    color: '#333', fontSize: 11,
    textAlign: 'center', maxWidth: '100%', marginTop: 8,
  },
  deleteBtn: {
    marginTop: 40, paddingVertical: 12, paddingHorizontal: 32,
    borderRadius: 10, borderWidth: 1, borderColor: '#3a1a1a',
    backgroundColor: '#1a0a0a',
  },
  deleteBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
});
