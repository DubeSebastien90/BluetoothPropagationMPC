import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../state/AppContext';

const LOGO = require('../../assets/toot_logo.png');

// Versioned key — must stay in sync with App.js identity restore logic
export const IDENTITY_KEY = 'identity_v1';

export function SetupScreen() {
  const { state, dispatch } = useApp();
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  const canConfirm = nickname.trim().length > 0 && !loading && !!state.crypto;

  const confirm = async () => {
    if (!canConfirm) return;
    setLoading(true);
    try {
      const pubkey   = state.crypto.getPublicKey();
      const identity = { nickname: nickname.trim(), pubkey };
      await AsyncStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
      dispatch({ type: 'SET_IDENTITY', payload: identity });
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#004E92', '#0077B6', '#00B4D8', '#48CAE4', '#ADE8F4', '#CAF0F8']}
      locations={[0, 0.18, 0.42, 0.65, 0.85, 1.0]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={s.shell}
    >
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={s.kav}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          <View style={s.inner}>

            {/* Hero */}
            <View style={s.hero}>
              <View style={s.logoWrap}>
                <View style={s.logoGloss} />
                <Image source={LOGO} style={s.logo} resizeMode="contain" />
              </View>
              <Text style={s.appName}>toot</Text>
              <Text style={s.tagline}>Mesh chat · no internet required</Text>
            </View>

            {/* Input card */}
            <View style={s.card}>
              <View style={s.cardGloss} />
              <Text style={s.cardLabel}>your name</Text>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="Nickname..."
                  placeholderTextColor="rgba(255,255,255,0.38)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={24}
                  onSubmitEditing={confirm}
                  returnKeyType="go"
                />
              </View>
              <Text style={s.hint}>
                This is how others will see you in the mesh.
              </Text>
            </View>

            {/* CTA button */}
            <TouchableOpacity
              style={[s.btn, !canConfirm && s.btnDisabled]}
              onPress={confirm}
              disabled={!canConfirm}
              activeOpacity={0.75}
            >
              <View style={s.btnGloss} />
              {loading
                ? <ActivityIndicator color="rgba(255,255,255,0.80)" />
                : <Text style={[s.btnText, !canConfirm && s.btnTextDisabled]}>
                    Get started
                  </Text>}
            </TouchableOpacity>

          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  shell: { flex: 1 },
  safe:  { flex: 1 },
  kav:   { flex: 1 },

  inner: {
    flex: 1, justifyContent: 'center',
    paddingHorizontal: 28, paddingVertical: 40, gap: 24,
  },

  /* Hero */
  hero: { alignItems: 'center', gap: 10 },
  logoWrap: {
    width: 80, height: 80, borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.52)',
    shadowColor: '#001840', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 14, elevation: 6,
  },
  logoGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '48%',
    backgroundColor: 'rgba(255,255,255,0.28)', zIndex: 1,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
  },
  logo: { width: 80, height: 80 },
  appName: {
    color: '#fff', fontSize: 42, fontWeight: '900',
    letterSpacing: -1.5,
    textShadowColor: 'rgba(0,30,80,0.22)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  tagline: {
    color: 'rgba(255,255,255,0.62)', fontSize: 13.5, fontWeight: '600',
    letterSpacing: 0.2,
  },

  /* Card */
  card: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)',
    padding: 20, gap: 12, overflow: 'hidden',
    shadowColor: '#001840', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16, shadowRadius: 12, elevation: 4,
  },
  cardGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  cardLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.3,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
  },
  inputWrap: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.46)',
    overflow: 'hidden',
  },
  input: {
    color: '#fff', backgroundColor: 'transparent',
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16,
  },
  hint: {
    color: 'rgba(255,255,255,0.42)', fontSize: 13, lineHeight: 20,
  },

  /* Button */
  btn: {
    borderRadius: 9999, paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.60)',
    alignItems: 'center', overflow: 'hidden',
    shadowColor: '#001840', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 4,
  },
  btnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  btnGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  btnText:         { color: '#fff', fontWeight: '800', fontSize: 16, zIndex: 1 },
  btnTextDisabled: { color: 'rgba(255,255,255,0.28)' },
});
