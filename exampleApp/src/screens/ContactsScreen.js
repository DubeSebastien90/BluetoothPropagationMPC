import React from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useApp } from '../state/AppContext';

export function ContactsScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const peerCount = state.peers.length;

  const confirmDeleteContact = (contact) => {
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

  const confirmUnsubscribe = (topicName) => {
    Alert.alert(
      'Unsubscribe',
      `Leave topic "${topicName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => dispatch({ type: 'UNSUBSCRIBE_TOPIC', payload: topicName }),
        },
      ]
    );
  };

  const sections = [
    { key: 'topics',   title: 'Topics',   data: state.topics },
    { key: 'contacts', title: 'Contacts', data: state.contacts },
  ];

  return (
    <View style={s.container}>
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

      <SectionList
        sections={sections}
        keyExtractor={(item, i) => (typeof item === 'string' ? item : item.pubkey) ?? String(i)}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            {section.key === 'topics' && (
              <TouchableOpacity onPress={() => navigation.navigate('SubscribeTopic')}>
                <Text style={s.sectionAction}>+ Subscribe</Text>
              </TouchableOpacity>
            )}
            {section.key === 'contacts' && section.data.length === 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('Scan')}>
                <Text style={s.sectionAction}>+ Scan</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        renderItem={({ item, section }) => {
          if (section.key === 'topics') {
            return (
              <TouchableOpacity
                style={s.row}
                onPress={() => navigation.navigate('TopicChat', { topicName: item })}
                onLongPress={() => confirmUnsubscribe(item)}
              >
                <View style={[s.avatar, s.avatarTopic]}>
                  <Text style={s.avatarText}>#</Text>
                </View>
                <Text style={s.name}>{item}</Text>
              </TouchableOpacity>
            );
          }
          const isOnline = state.peers.some(p => p.name === item.nickname);
          return (
            <TouchableOpacity
              style={s.row}
              onPress={() => navigation.navigate('Chat', { contact: item })}
              onLongPress={() => confirmDeleteContact(item)}
            >
              <View style={s.avatarWrapper}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{item.nickname[0].toUpperCase()}</Text>
                </View>
                {isOnline && <View style={s.onlineDot} />}
              </View>
              <View style={s.rowText}>
                <Text style={s.name}>{item.nickname}</Text>
                <Text style={s.id} numberOfLines={1} ellipsizeMode="middle">
                  {item.pubkey}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>No contacts yet</Text>
            <Text style={s.emptyBody}>
              Tap Scan to add contacts, or subscribe to a topic to chat.
            </Text>
            <TouchableOpacity style={s.scanBtn} onPress={() => navigation.navigate('Scan')}>
              <Text style={s.scanBtnText}>Scan QR Code</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderColor: '#1a1a1a',
  },
  statusText:       { color: '#555', fontSize: 13 },
  broadcastBtn:     { backgroundColor: '#1e3a5f', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  broadcastBtnText: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6,
  },
  sectionTitle:  { color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionAction: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderColor: '#111', gap: 12,
  },
  avatarWrapper: { position: 'relative' },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1e3a5f', alignItems: 'center', justifyContent: 'center',
  },
  avatarTopic: { backgroundColor: '#1a2a1e' },
  avatarText:  { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#0a0a1a',
  },
  rowText: { flex: 1 },
  name:    { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  id:      { color: '#333', fontSize: 11, marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptyBody:  { color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  scanBtn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  scanBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
