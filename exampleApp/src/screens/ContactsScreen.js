import React from 'react';
import {
  View, Text, FlatList, SectionList, TouchableOpacity, StyleSheet, Alert,
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
          text: 'Remove', style: 'destructive',
          onPress: () => dispatch({ type: 'REMOVE_CONTACT', payload: contact.pubkey }),
        },
      ]
    );
  };

  const confirmLeaveGroup = (group) => {
    Alert.alert(
      'Leave group',
      `Leave "${group.name}"? You won't receive messages from this group anymore.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive',
          onPress: () => dispatch({ type: 'REMOVE_GROUP', payload: group.groupId }),
        },
      ]
    );
  };

  const sections = [
    { title: 'GROUPS',   data: state.groups,   key: 'groups'   },
    { title: 'CONTACTS', data: state.contacts,  key: 'contacts' },
  ].filter(s => s.data.length > 0);

  return (
    <View style={s.container}>
      {/* Status bar */}
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
        keyExtractor={(item) => item.pubkey ?? item.groupId}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>No contacts yet</Text>
            <Text style={s.emptyBody}>
              Tap Scan to scan someone's QR code and add them.
            </Text>
            <TouchableOpacity
              style={s.scanBtn}
              onPress={() => navigation.navigate('Scan')}
            >
              <Text style={s.scanBtnText}>Scan QR Code</Text>
            </TouchableOpacity>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            {section.key === 'groups' && (
              <TouchableOpacity onPress={() => navigation.navigate('CreateGroup')}>
                <Text style={s.newGroupBtn}>+ New</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        renderItem={({ item, section }) => {
          if (section.key === 'groups') {
            return (
              <TouchableOpacity
                style={s.row}
                onPress={() => navigation.navigate('GroupChat', { group: item })}
                onLongPress={() => confirmLeaveGroup(item)}
              >
                <View style={[s.avatar, s.groupAvatar]}>
                  <Text style={s.avatarText}>🫂</Text>
                </View>
                <View style={s.rowText}>
                  <Text style={s.name}>{item.name}</Text>
                  <Text style={s.sub}>
                    {item.members.map(m => m.nickname).join(', ')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              style={s.row}
              onPress={() => navigation.navigate('Chat', { contact: item })}
              onLongPress={() => confirmDeleteContact(item)}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>{item.nickname[0].toUpperCase()}</Text>
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
        ListFooterComponent={
          sections.length === 0 ? null : (
            <TouchableOpacity
              style={s.newGroupFooter}
              onPress={() => navigation.navigate('CreateGroup')}
            >
              <Text style={s.newGroupFooterText}>+ New Group</Text>
            </TouchableOpacity>
          )
        }
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

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8,
  },
  sectionTitle: { color: '#444', fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
  newGroupBtn:  { color: '#2563eb', fontSize: 13, fontWeight: '600' },

  emptyBox:  { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
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
  groupAvatar:  { backgroundColor: '#1a2a1a' },
  avatarText:   { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  rowText:      { flex: 1 },
  name:         { color: '#fff', fontSize: 16, fontWeight: '600' },
  sub:          { color: '#444', fontSize: 12, marginTop: 2 },
  id:           { color: '#333', fontSize: 11, marginTop: 2 },

  newGroupFooter: {
    margin: 16, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#1e3a5f', alignItems: 'center',
  },
  newGroupFooterText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
});
