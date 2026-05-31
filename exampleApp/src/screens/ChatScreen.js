import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput,
  TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { useApp } from '../state/AppContext';
import { encodeLocation } from '../utils/locationMessage';

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
    state.router.send(contact.nickname, contact.pubkey, body, 'location');
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id:     Date.now().toString(),
        from:   state.identity.nickname,
        fromId: myPubkey,
        to:     contact.nickname,
        toId:   contact.pubkey,
        body,
        type:   'location',
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
        type:   'msg',
        ts:     Date.now(),
      },
    });
    setInput('');
  };

  const renderBubble = ({ item }) => {
    const isMine = item.fromId === myPubkey;

    if (item.type === 'location') {
      const coords = JSON.parse(item.body);
      return (
        <View style={[s.bubble, isMine ? s.mine : s.theirs]}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Map', {
              type: 'location',
              lat:  coords.lat / 1e6,
              lng:  coords.lng / 1e6,
            })}
          >
            <Text style={s.locationIcon}>📍</Text>
            <Text style={s.locationLabel}>Shared a location</Text>
            <Text style={s.locationHint}>Tap to open map</Text>
          </TouchableOpacity>
          <Text style={s.meta}>{item.from} · {new Date(item.ts).toLocaleTimeString()}</Text>
        </View>
      );
    }

    if (item.type === 'meetingpoint') {
      const coords = JSON.parse(item.body);
      return (
        <View style={[s.bubble, isMine ? s.mine : s.theirs]}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Map', {
              type:    'meetingpoint',
              meetLat: coords.meetLat / 1e6,
              meetLng: coords.meetLng / 1e6,
              fromLat: coords.fromLat / 1e6,
              fromLng: coords.fromLng / 1e6,
            })}
          >
            <Text style={s.locationIcon}>🏴</Text>
            <Text style={s.locationLabel}>Proposed a meeting point</Text>
            <Text style={s.locationHint}>Tap to open map</Text>
          </TouchableOpacity>
          <Text style={s.meta}>{item.from} · {new Date(item.ts).toLocaleTimeString()}</Text>
        </View>
      );
    }

    if (item.type === 'arrival') {
      const { message } = JSON.parse(item.body);
      return (
        <View style={[s.bubble, s.arrival]}>
          <Text style={s.arrivalText}>{message}</Text>
          <Text style={s.meta}>{new Date(item.ts).toLocaleTimeString()}</Text>
        </View>
      );
    }

    return (
      <View style={[s.bubble, isMine ? s.mine : s.theirs]}>
        <Text style={s.body}>{item.body}</Text>
        <Text style={s.meta}>{item.from} · {new Date(item.ts).toLocaleTimeString()}</Text>
      </View>
    );
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
        renderItem={renderBubble}
        ListEmptyComponent={
          <Text style={s.empty}>No messages yet.{'\n'}Say something!</Text>
        }
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
  sendBtnText:   { color: '#fff', fontWeight: 'bold' },
  headerBtns:    { flexDirection: 'row', marginRight: 8 },
  headerBtn:     { padding: 4, marginLeft: 4 },
  headerBtnText: { fontSize: 22 },
  locationIcon:  { fontSize: 28, textAlign: 'center' },
  locationLabel: { color: '#fff', fontWeight: '600', fontSize: 14, textAlign: 'center', marginTop: 4 },
  locationHint:  { color: '#aaa', fontSize: 11, textAlign: 'center', marginTop: 2 },
  arrival:       { backgroundColor: '#14532d', alignSelf: 'center', maxWidth: '90%' },
  arrivalText:   { color: '#4ade80', fontWeight: '600', fontSize: 14, textAlign: 'center' },
});
