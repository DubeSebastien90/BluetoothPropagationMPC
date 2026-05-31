import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput,
  TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { useApp } from '../state/AppContext';
import { encodeLocation, decodeLocation, decodeMeetingPoint } from '../utils/locationMessage';

/**
 * Props:
 *   route.params.contact: { nickname, pubkey }
 *
 * Reads router from AppContext.
 * Routes by pubkey (toId) — two users named "Alex" are never confused.
 */
export function ChatScreen({ route, navigation }) {
  const { contact } = route.params;
  const { state, dispatch } = useApp();
  const [input, setInput] = useState('');
  const listRef = useRef(null);

  const myPubkey = state.identity?.pubkey;

  const shareLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location access is required to share your position.');
      return;
    }
    const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const body = encodeLocation(coords.latitude, coords.longitude);
    state.router.send(contact.nickname, contact.pubkey, body);
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id:     Date.now().toString(),
        from:   state.identity.nickname,
        fromId: myPubkey,
        to:     contact.nickname,
        toId:   contact.pubkey,
        body,
        ts:     Date.now(),
      },
    });
  }, [state.router, state.identity, contact, myPubkey, dispatch]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={s.headerBtns}>
          <TouchableOpacity
            onPress={() => navigation.navigate('PickMeetingPoint', { contact })}
            style={s.headerBtn}
          >
            <Text style={s.headerBtnText}>🏴</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={shareLocation} style={s.headerBtn}>
            <Text style={s.headerBtnText}>📍</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, shareLocation, contact]);

  const thread = state.messages.filter(m =>
    (m.fromId === myPubkey       && m.toId === contact.pubkey) ||
    (m.fromId === contact.pubkey && m.toId === myPubkey)
  );

  const send = () => {
    if (!input.trim() || !state.router) return;
    const body = input.trim();
    state.router.send(contact.nickname, contact.pubkey, body);
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id:     Date.now().toString(),
        from:   state.identity.nickname,
        fromId: myPubkey,
        to:     contact.nickname,
        toId:   contact.pubkey,
        body,
        ts:     Date.now(),
      },
    });
    setInput('');
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
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <Text style={s.empty}>
            No messages yet.{'\n'}Say something!
          </Text>
        }
        renderItem={({ item }) => {
          const loc  = decodeLocation(item.body);
          const meet = decodeMeetingPoint(item.body);
          const isMine = item.fromId === myPubkey;
          return (
            <View style={[s.bubble, isMine ? s.mine : s.theirs]}>
              {loc ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Map', { type: 'location', lat: loc.lat, lng: loc.lng })}
                >
                  <Text style={s.locationIcon}>📍</Text>
                  <Text style={s.locationLabel}>Shared a location</Text>
                  <Text style={s.locationHint}>Tap to open map</Text>
                </TouchableOpacity>
              ) : meet ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Map', {
                    type:    'meetingpoint',
                    meetLat: meet.meetLat,
                    meetLng: meet.meetLng,
                    fromLat: meet.fromLat,
                    fromLng: meet.fromLng,
                  })}
                >
                  <Text style={s.locationIcon}>🏴</Text>
                  <Text style={s.locationLabel}>Proposed a meeting point</Text>
                  <Text style={s.locationHint}>Tap to open map</Text>
                </TouchableOpacity>
              ) : (
                <Text style={s.body}>{item.body}</Text>
              )}
              <Text style={s.meta}>
                {item.from} · {new Date(item.ts).toLocaleTimeString()}
              </Text>
            </View>
          );
        }}
      />
      <View style={s.composer}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message..."
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
  empty: {
    color: '#333', textAlign: 'center',
    marginTop: 80, lineHeight: 24,
  },
  bubble: {
    margin: 8, padding: 10, borderRadius: 12, maxWidth: '75%',
  },
  mine:   { backgroundColor: '#1e3a5f', alignSelf: 'flex-end' },
  theirs: { backgroundColor: '#1a1a1a', alignSelf: 'flex-start' },
  body:   { color: '#fff', fontSize: 15 },
  meta:   { color: '#555', fontSize: 11, marginTop: 4 },
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
  sendBtnText:    { color: '#fff', fontWeight: 'bold' },
  headerBtns:     { flexDirection: 'row', marginRight: 8 },
  headerBtn:      { padding: 4, marginLeft: 4 },
  headerBtnText:  { fontSize: 22 },
  locationIcon:   { fontSize: 28, textAlign: 'center' },
  locationLabel:  { color: '#fff', fontWeight: '600', fontSize: 14, textAlign: 'center', marginTop: 4 },
  locationHint:   { color: '#aaa', fontSize: 11, textAlign: 'center', marginTop: 2 },
});
