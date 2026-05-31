import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, Animated,
} from 'react-native';

const AUTO_DISMISS_MS = 5000;

/**
 * Props:
 *   notif: { nickname, pubkey, type: 'contact_req' | 'contact_ack' } | null
 *   onDismiss: () => void
 */
export function ContactNotifModal({ notif, onDismiss }) {
  const opacity  = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (!notif) return;

    // Fade in
    Animated.timing(opacity, {
      toValue: 1, duration: 200, useNativeDriver: true,
    }).start();

    // Auto-dismiss
    timerRef.current = setTimeout(() => {
      dismiss();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timerRef.current);
  }, [notif]);

  const dismiss = () => {
    Animated.timing(opacity, {
      toValue: 0, duration: 150, useNativeDriver: true,
    }).start(() => onDismiss());
  };

  if (!notif) return null;

  const isGroupInvite = notif.type === 'group_invite';
  const isReq         = notif.type === 'contact_req';

  if (isGroupInvite) {
    const members = notif.members ?? [];
    return (
      <Modal transparent animationType="none" visible={!!notif} onRequestClose={dismiss}>
        <View style={s.backdrop}>
          <Animated.View style={[s.card, { opacity }]}>
            <View style={s.iconRow}><Text style={s.icon}>🫂</Text></View>
            <Text style={s.title}>Group invite</Text>
            <Text style={s.name}>{notif.name}</Text>
            <Text style={s.sub}>You were added to this group.</Text>
            <Text style={s.membersLabel}>Members</Text>
            {members.map(m => (
              <Text key={m.pubkey} style={s.memberItem}>{m.nickname}</Text>
            ))}
            <TouchableOpacity style={[s.btn, { marginTop: 20 }]} onPress={dismiss}>
              <Text style={s.btnText}>Got it</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal transparent animationType="none" visible={!!notif} onRequestClose={dismiss}>
      <View style={s.backdrop}>
        <Animated.View style={[s.card, { opacity }]}>
          <View style={s.iconRow}>
            <Text style={s.icon}>{isReq ? '👋' : '✅'}</Text>
          </View>
          <Text style={s.title}>
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
          <TouchableOpacity style={s.btn} onPress={dismiss}>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  iconRow:  { marginBottom: 12 },
  icon:     { fontSize: 36 },
  title:    { color: '#888', fontSize: 13, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  name:     { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 6 },
  sub:      { color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 12, lineHeight: 20 },
  id:       { color: '#333', fontSize: 10, marginBottom: 20, maxWidth: '100%' },
  btn: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  btnText:      { color: '#fff', fontWeight: '600', fontSize: 14 },
  membersLabel: { color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 6 },
  memberItem:   { color: '#aaa', fontSize: 14, marginBottom: 2 },
});
