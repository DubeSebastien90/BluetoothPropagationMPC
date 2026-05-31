import React, { useState, useRef } from 'react';
import {
  View, Text, FlatList, TextInput,
  TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useApp } from '../state/AppContext';

export function TopicChatScreen({ route }) {
  const { topicName } = route.params;
  const { state, dispatch } = useApp();
  const [input, setInput]   = useState('');
  const listRef             = useRef(null);

  const myPubkey = state.identity?.pubkey;
  const thread   = state.messages.filter(m => m.topic === topicName);

  const send = () => {
    if (!input.trim() || !state.router) return;
    const body = input.trim();

    state.router.sendTopicMessage(topicName, body);

    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id:      Date.now().toString(),
        from:    state.identity.nickname,
        fromId:  myPubkey,
        to:      'all',
        toId:    'all',
        topic:   topicName,
        body,
        ts:      Date.now(),
      },
    });

    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FlatList
        ref={listRef}
        data={thread}
        keyExtractor={m => m.id}
        style={s.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <Text style={s.empty}>
            No messages in #{topicName} yet.{'\n'}Say something!
          </Text>
        }
        renderItem={({ item }) => {
          const mine = item.fromId === myPubkey;
          return (
            <View style={[s.bubble, mine ? s.mine : s.theirs]}>
              {!mine && <Text style={s.sender}>{item.from}</Text>}
              <Text style={s.body}>{item.body}</Text>
              <Text style={s.meta}>{new Date(item.ts).toLocaleTimeString()}</Text>
            </View>
          );
        }}
      />

      <View style={s.composer}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder={`Message #${topicName}...`}
          placeholderTextColor="#555"
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <TouchableOpacity style={s.sendBtn} onPress={send}>
          <Text style={s.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  list:      { flex: 1 },
  empty: {
    color: '#333', textAlign: 'center',
    marginTop: 80, lineHeight: 24,
  },
  bubble: {
    margin: 8, padding: 10, borderRadius: 12, maxWidth: '80%',
  },
  mine:    { backgroundColor: '#1e3a5f', alignSelf: 'flex-end' },
  theirs:  { backgroundColor: '#1a1a1a', alignSelf: 'flex-start' },
  sender:  { color: '#2563eb', fontSize: 12, fontWeight: '600', marginBottom: 3 },
  body:    { color: '#fff', fontSize: 15 },
  meta:    { color: '#555', fontSize: 11, marginTop: 4 },
  composer: {
    flexDirection: 'row', padding: 10,
    paddingBottom: Platform.OS === 'android' ? 64 : 10,
    borderTopWidth: 1, borderColor: '#1a1a1a', gap: 8,
  },
  input: {
    flex: 1, backgroundColor: '#111', color: '#fff',
    borderRadius: 8, padding: 10, fontSize: 15,
  },
  sendBtn: {
    backgroundColor: '#2563eb', borderRadius: 8,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  sendBtnText: { color: '#fff', fontWeight: 'bold' },
});
