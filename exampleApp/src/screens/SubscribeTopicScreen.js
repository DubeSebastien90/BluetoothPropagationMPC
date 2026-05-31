import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useApp } from '../state/AppContext';

export function SubscribeTopicScreen({ navigation }) {
  const { dispatch } = useApp();
  const [name, setName] = useState('');

  const trimmed = name.trim().toLowerCase();
  const canSubscribe = trimmed.length > 0;

  const subscribe = () => {
    if (!canSubscribe) return;
    dispatch({ type: 'SUBSCRIBE_TOPIC', payload: trimmed });
    navigation.replace('TopicChat', { topicName: trimmed });
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.inner}>
        <Text style={s.label}>Topic name</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. mainstage, lostphone, camp-a"
          placeholderTextColor="#444"
          autoCapitalize="none"
          autoFocus
          onSubmitEditing={subscribe}
          returnKeyType="go"
        />
        <Text style={s.hint}>
          Anyone who subscribes to the same topic name sees the same messages.
          No invite needed — just share the name.
        </Text>
        <TouchableOpacity
          style={[s.btn, !canSubscribe && s.btnDisabled]}
          onPress={subscribe}
          disabled={!canSubscribe}
        >
          <Text style={s.btnText}>Subscribe</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  inner: { padding: 24, gap: 16 },
  label: { color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: '#111', color: '#fff', borderRadius: 10,
    padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#222',
  },
  hint: { color: '#444', fontSize: 13, lineHeight: 20 },
  btn: {
    backgroundColor: '#2563eb', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
