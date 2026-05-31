import React, { useState, useRef } from 'react';
import {
  View, Text, FlatList, TextInput,
  TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';

export function TopicChatScreen({ route }) {
  const { topicName } = route.params;
  const { state, dispatch } = useApp();
  const [input, setInput] = useState('');
  const listRef = useRef(null);
  const insets = useSafeAreaInsets();

  const myPubkey = state.identity?.pubkey;
  const thread   = state.messages.filter(m => m.topic === topicName);

  const send = () => {
    if (!input.trim() || !state.router) return;
    const body = input.trim();
    state.router.sendTopicMessage(topicName, body);
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id:     Date.now().toString(),
        from:   state.identity.nickname,
        fromId: myPubkey,
        to:     'all',
        toId:   'all',
        topic:  topicName,
        body,
        ts:     Date.now(),
      },
    });
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <LinearGradient
      colors={['#004E92', '#0077B6', '#00B4D8', '#48CAE4', '#ADE8F4', '#CAF0F8']}
      locations={[0, 0.18, 0.42, 0.65, 0.85, 1.0]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={s.shell}
    >
      <KeyboardAvoidingView
        style={s.kav}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : insets.bottom}
      >
        <FlatList
          ref={listRef}
          data={thread}
          keyExtractor={m => m.id}
          contentContainerStyle={s.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Text style={s.empty}>
                No messages in #{topicName} yet.{'\n'}Say something! 🦋
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.fromId === myPubkey;
            return (
              <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                {!mine && <Text style={s.sender}>{item.from}</Text>}
                <Text style={mine ? s.body : s.bodyTheirs}>{item.body}</Text>
                <Text style={mine ? s.meta : s.metaTheirs}>
                  {new Date(item.ts).toLocaleTimeString()}
                </Text>
              </View>
            );
          }}
        />

        <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 6) }]}>
          <View style={s.composerGloss} />
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder={`Message #${topicName}...`}
            placeholderTextColor="#88BBCC"
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <TouchableOpacity style={s.sendBtn} onPress={send} activeOpacity={0.75}>
            <View style={s.sendBtnGloss} />
            <Text style={s.sendBtnText}>›</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  shell: { flex: 1 },
  kav:   { flex: 1 },

  listContent: {
    flexGrow: 1, padding: 12, paddingBottom: 6, gap: 6,
    justifyContent: 'flex-end',
  },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  empty:    { color: 'rgba(255,255,255,0.50)', textAlign: 'center', fontSize: 14, lineHeight: 24 },

  bubble: { maxWidth: '72%', paddingHorizontal: 11, paddingVertical: 7 },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: '#0077B6',
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 4,
    borderWidth: 1, borderColor: 'rgba(0,150,210,0.32)',
    shadowColor: '#001840', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20, shadowRadius: 6, elevation: 3,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    borderBottomLeftRadius: 4, borderBottomRightRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(120,190,230,0.38)',
    shadowColor: '#0050A0', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09, shadowRadius: 5, elevation: 2,
  },
  sender:     { color: '#4488AA', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  body:       { color: '#fff',    fontSize: 13, lineHeight: 18 },
  bodyTheirs: { color: '#003366', fontSize: 13, lineHeight: 18 },
  meta:       { color: 'rgba(180,215,245,0.70)', fontSize: 10, marginTop: 3 },
  metaTheirs: { color: '#88BBCC',                fontSize: 10, marginTop: 3 },

  composer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingTop: 6, paddingBottom: 6, gap: 6,
    backgroundColor: 'rgba(210,235,255,0.94)',
    borderTopWidth: 1, borderTopColor: 'rgba(100,170,220,0.35)',
    overflow: 'hidden',
  },
  composerGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '55%',
    backgroundColor: 'rgba(255,255,255,0.46)',
  },
  input: {
    flex: 1, minHeight: 38,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 19, borderWidth: 1, borderColor: 'rgba(100,170,220,0.42)',
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 13, color: '#003366', zIndex: 1,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.58)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', zIndex: 1,
  },
  sendBtnGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '44%',
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderTopLeftRadius: 19, borderTopRightRadius: 19,
  },
  sendBtnText: { color: '#004E92', fontSize: 18, fontWeight: '800', zIndex: 1 },
});
