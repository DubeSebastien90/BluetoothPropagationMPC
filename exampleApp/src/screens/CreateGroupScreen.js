import React, { useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useApp } from '../state/AppContext';

const TAG = '[CREATE-GROUP]';

export function CreateGroupScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected]   = useState(new Set()); // pubkeys

  const toggleMember = (pubkey) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(pubkey) ? next.delete(pubkey) : next.add(pubkey);
      return next;
    });
  };

  const canCreate = groupName.trim().length > 0 && selected.size > 0;

  const createGroup = () => {
    if (!canCreate || !state.router) return;

    const groupId          = 'grp-' + Math.random().toString(36).slice(2, 8);
    const selectedContacts = state.contacts.filter(c => selected.has(c.pubkey));

    const group = {
      groupId,
      name:      groupName.trim(),
      members:   [
        { nickname: state.identity.nickname, pubkey: state.identity.pubkey },
        ...selectedContacts,
      ],
      createdAt: Date.now(),
    };

    console.log(TAG, 'creating group:', group.name, groupId, 'members:', group.members.length);

    dispatch({ type: 'ADD_GROUP', payload: group });

    if (state.peers.length === 0) {
      Alert.alert(
        'No peers in range',
        'Group created locally. No one is connected right now — invite will be sent when they reconnect.',
      );
    }

    state.router.sendGroupInvite(group);

    navigation.replace('GroupChat', { group });
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.nameSection}>
        <Text style={s.label}>Group name</Text>
        <TextInput
          style={s.input}
          value={groupName}
          onChangeText={setGroupName}
          placeholder="e.g. Festival Crew"
          placeholderTextColor="#444"
          maxLength={32}
          autoFocus
        />
      </View>

      <Text style={s.label2}>Add members ({selected.size} selected)</Text>

      <FlatList
        data={state.contacts}
        keyExtractor={c => c.pubkey}
        style={s.list}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No contacts yet.</Text>
            <Text style={s.emptyHint}>Scan someone's QR code first.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selected.has(item.pubkey);
          return (
            <TouchableOpacity
              style={[s.row, isSelected && s.rowSelected]}
              onPress={() => toggleMember(item.pubkey)}
            >
              <View style={[s.check, isSelected && s.checkSelected]}>
                {isSelected && <Text style={s.checkMark}>✓</Text>}
              </View>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{item.nickname[0].toUpperCase()}</Text>
              </View>
              <Text style={s.name}>{item.nickname}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.createBtn, !canCreate && s.createBtnDisabled]}
          onPress={createGroup}
          disabled={!canCreate}
        >
          <Text style={s.createBtnText}>
            {canCreate
              ? `Create "${groupName}" with ${selected.size + 1} members`
              : 'Enter a name and select members'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0a0a1a' },
  nameSection: { padding: 16, borderBottomWidth: 1, borderColor: '#1a1a1a' },
  label:       { color: '#555', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  label2:      { color: '#555', fontSize: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: '#111', color: '#fff', borderRadius: 10,
    padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#222',
  },
  list:      { flex: 1 },
  emptyBox:  { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { color: '#555', fontSize: 15 },
  emptyHint: { color: '#333', fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderColor: '#111', gap: 12,
  },
  rowSelected: { backgroundColor: '#0d1a2e' },
  check: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1, borderColor: '#333',
    alignItems: 'center', justifyContent: 'center',
  },
  checkSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkMark:     { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#1e3a5f', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  name:       { color: '#fff', fontSize: 16, flex: 1 },
  footer: { padding: 16, borderTopWidth: 1, borderColor: '#1a1a1a' },
  createBtn: {
    backgroundColor: '#2563eb', borderRadius: 12,
    padding: 16, alignItems: 'center',
  },
  createBtnDisabled: { backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  createBtnText:     { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
