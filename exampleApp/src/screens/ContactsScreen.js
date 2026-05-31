import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useApp } from '../state/AppContext';

/**
 * Lists scanned contacts. Tap to open ChatScreen.
 * Header buttons navigate to Profile and Scan screens.
 */
export function ContactsScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const peerCount = state.peers.length;

  const confirmDelete = (contact) => {
    Alert.alert(
      'Remove contact',
      `Remove ${contact.nickname} from your contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => dispatch({ type: 'REMOVE_CONTACT', payload: contact.pubkey }),
        },
      ]
    );
  };

  return (
    <View style={s.container}>
      {/* Status + broadcast button */}
      <View style={s.statusBar}>
        <Text style={s.statusText}>
          {peerCount === 0
            ? '📡 scanning for peers...'
            : `🔗 ${peerCount} peer${peerCount > 1 ? 's' : ''} in range`}
        </Text>
        <TouchableOpacity
          style={s.broadcastBtn}
          onPress={() => navigation.navigate('Broadcast')}
        >
          <Text style={s.broadcastBtnText}>📡 Broadcast</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={state.contacts}
        keyExtractor={c => c.pubkey}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>No contacts yet</Text>
            <Text style={s.emptyBody}>
              Tap Scan to scan someone's QR code and add them as a contact.
            </Text>
            <TouchableOpacity
              style={s.scanBtn}
              onPress={() => navigation.navigate('Scan')}
            >
              <Text style={s.scanBtnText}>Scan QR Code</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.row}
            onPress={() => navigation.navigate('Chat', { contact: item })}
            onLongPress={() => confirmDelete(item)}
          >
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {item.nickname.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={s.rowText}>
              <Text style={s.name}>{item.nickname}</Text>
              <Text style={s.id} numberOfLines={1} ellipsizeMode="middle">
                {item.pubkey}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0a0a1a' },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderColor: '#1a1a1a',
  },
  statusText:       { color: '#555', fontSize: 13 },
  broadcastBtn:     { backgroundColor: '#1e3a5f', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  broadcastBtnText: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
  emptyBox: {
    alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12,
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptyBody:  { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  scanBtn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  scanBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderColor: '#111', gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1e3a5f', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  rowText:    { flex: 1 },
  name:       { color: '#fff', fontSize: 16, fontWeight: '600' },
  id:         { color: '#333', fontSize: 11, marginTop: 2 },
});
