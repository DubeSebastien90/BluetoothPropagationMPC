import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { encodeIdentityForQR } from '../contracts/IdentityContract';
import { useApp } from '../state/AppContext';

export function ProfileScreen() {
  const { state } = useApp();
  const { identity } = state;

  if (!identity) return null;

  const qrValue = encodeIdentityForQR(identity);

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
});
