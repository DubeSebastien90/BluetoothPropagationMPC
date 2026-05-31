import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, Animated, Platform,
} from 'react-native';

const AUTO_DISMISS_MS = 5000;

/**
 * Props:
 *   notif: { nickname, pubkey, type: 'contact_req' | 'contact_ack' } | null
 *   onDismiss: () => void
 */
export function ContactNotifModal({ notif, onDismiss }) {
  const opacity  = useRef(new Animated.Value(0)).current;
  const slideY   = useRef(new Animated.Value(24)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (!notif) return;

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideY,  { toValue: 0, speed: 18, bounciness: 6, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(timerRef.current);
  }, [notif]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slideY,  { toValue: 16, duration: 160, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  if (!notif) return null;

  const isReq = notif.type === 'contact_req';

  return (
    <Modal transparent animationType="none" visible={!!notif} onRequestClose={dismiss}>
      <View style={s.backdrop}>
        <Animated.View style={[s.card, { opacity, transform: [{ translateY: slideY }] }]}>
          <View style={s.cardGloss} />

          {/* Icon pill */}
          <View style={s.iconPill}>
            <Text style={s.icon}>{isReq ? '👋' : '✅'}</Text>
          </View>

          <Text style={s.label}>
            {isReq ? 'New contact' : 'Contact confirmed'}
          </Text>
          <Text style={s.name}>{notif.nickname}</Text>
          <Text style={s.sub}>
            {isReq
              ? 'added you as a contact via QR scan.'
              : 'confirmed your contact request.'}
          </Text>
          <Text style={s.id} numberOfLines={1} ellipsizeMode="middle">
            {notif.pubkey}
          </Text>

          <TouchableOpacity style={s.btn} onPress={dismiss} activeOpacity={0.75}>
            <View style={s.btnGloss} />
            <Text style={s.btnText}>Dismiss</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,30,80,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },

  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(120,190,240,0.30)',
    shadowColor: '#001840', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22, shadowRadius: 18, elevation: 10,
  },
  cardGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '46%',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
  },

  iconPill: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(0,119,182,0.10)',
    borderWidth: 1.5, borderColor: 'rgba(0,119,182,0.22)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  icon: { fontSize: 28 },

  label: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.3,
    textTransform: 'uppercase', color: '#88BBCC',
  },
  name: {
    color: '#003366', fontSize: 24, fontWeight: '900',
    marginTop: 2,
  },
  sub: {
    color: '#4488AA', fontSize: 14, textAlign: 'center',
    lineHeight: 20, marginTop: 2,
  },
  id: {
    color: '#A8C8DC', fontSize: 10, marginTop: 4, maxWidth: '100%',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },

  btn: {
    marginTop: 14, paddingVertical: 13, paddingHorizontal: 40,
    borderRadius: 9999,
    backgroundColor: '#0077B6',
    overflow: 'hidden',
    shadowColor: '#001840', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.20, shadowRadius: 8, elevation: 4,
  },
  btnGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '48%',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15, zIndex: 1 },
});
