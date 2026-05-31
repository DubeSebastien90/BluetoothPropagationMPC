import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';

export function SubscribeTopicScreen({ navigation }) {
  const { dispatch } = useApp();
  const [name, setName] = useState('');
  const insets = useSafeAreaInsets();

  const trimmed = name.trim().toLowerCase();
  const canSubscribe = trimmed.length > 0;

  const subscribe = () => {
    if (!canSubscribe) return;
    dispatch({ type: 'SUBSCRIBE_TOPIC', payload: trimmed });
    navigation.replace('TopicChat', { topicName: trimmed });
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
        <View style={[s.inner, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}>

          <Text style={s.label}>Topic name</Text>

          <View style={s.inputCard}>
            <View style={s.inputCardReflet} />
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. mainstage, lostphone, camp-a"
              placeholderTextColor="rgba(255,255,255,0.35)"
              autoCapitalize="none"
              autoFocus
              onSubmitEditing={subscribe}
              returnKeyType="go"
            />
          </View>

          <Text style={s.hint}>
            Anyone who subscribes to the same topic name sees the same messages.
            No invite needed — just share the name.
          </Text>

          <TouchableOpacity
            style={[s.btn, !canSubscribe && s.btnDisabled]}
            onPress={subscribe}
            disabled={!canSubscribe}
            activeOpacity={0.75}
          >
            <View style={s.btnGloss} />
            <Text style={[s.btnText, !canSubscribe && s.btnTextDisabled]}>
              Subscribe
            </Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  shell: { flex: 1 },
  kav:   { flex: 1 },

  inner: {
    flex: 1, justifyContent: 'center',
    paddingHorizontal: 24, paddingTop: 32, gap: 16,
  },

  label: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.3,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
  },

  inputCard: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.50)',
    overflow: 'hidden',
    shadowColor: '#001840', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14, shadowRadius: 8, elevation: 3,
  },
  inputCardReflet: {
    position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 9999,
  },
  input: {
    color: '#fff', backgroundColor: 'transparent',
    padding: 14, fontSize: 15,
  },

  hint: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 13, lineHeight: 20,
  },

  btn: {
    borderRadius: 9999, paddingVertical: 15,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.50)',
    alignItems: 'center', overflow: 'hidden',
    shadowColor: '#001840', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16, shadowRadius: 8, elevation: 3,
  },
  btnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  btnGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  btnText:         { color: '#fff', fontWeight: '800', fontSize: 15, zIndex: 1 },
  btnTextDisabled: { color: 'rgba(255,255,255,0.30)' },
});
