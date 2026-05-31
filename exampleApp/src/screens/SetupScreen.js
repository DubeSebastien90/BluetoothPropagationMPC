import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../state/AppContext';

export function SetupScreen({ crypto }) {
  const { dispatch } = useApp();
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    try {
      const { pubkey } = await crypto.initialize();
      const identity = { nickname: nickname.trim(), pubkey };
      await AsyncStorage.setItem('identity', JSON.stringify(identity));
      dispatch({ type: 'SET_IDENTITY', payload: identity });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Mesh Chat</Text>
      <Text style={s.subtitle}>Choose your name to get started</Text>
      <TextInput
        style={s.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder="Your nickname..."
        placeholderTextColor="#555"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={24}
        onSubmitEditing={confirm}
      />
      <TouchableOpacity
        style={[s.btn, (!nickname.trim() || loading) && s.btnDisabled]}
        onPress={confirm}
        disabled={!nickname.trim() || loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.btnText}>Start</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0a0a1a',
    alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16,
  },
  title:    { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  subtitle: { color: '#555', fontSize: 15, marginBottom: 8 },
  input: {
    width: '100%', backgroundColor: '#111', color: '#fff',
    borderRadius: 10, padding: 14, fontSize: 16,
    borderWidth: 1, borderColor: '#222',
  },
  btn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    padding: 14, width: '100%', alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#1a1a1a' },
  btnText:     { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
