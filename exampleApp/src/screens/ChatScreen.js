import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput,
  TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useApp } from '../state/AppContext';
import { encodeLocation } from '../utils/locationMessage';

export function ChatScreen({ route, navigation }) {
  const { contact } = route.params;
  const { state, dispatch } = useApp();
  const [input, setInput] = useState('');
  const listRef = useRef(null);
  const insets = useSafeAreaInsets();

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
          {isMine ? <View style={s.bubbleGlossMine} /> : <><View style={s.bubbleGlossTheirs} /><View style={s.bubbleShadeTheirs} /></>}
          <TouchableOpacity
            onPress={() => navigation.navigate('Map', {
              type: 'location',
              lat:  coords.lat / 1e6,
              lng:  coords.lng / 1e6,
            })}
            style={s.specialCard}
          >
            <Text style={s.specialIcon}>📍</Text>
            <Text style={isMine ? s.specialLabel : s.specialLabelTheirs}>
              Shared a location
            </Text>
            <Text style={isMine ? s.specialHint : s.specialHintTheirs}>
              Tap to open map
            </Text>
          </TouchableOpacity>
          <Text style={isMine ? s.meta : s.metaTheirs}>
            {item.from} · {new Date(item.ts).toLocaleTimeString()}
          </Text>
        </View>
      );
    }

    if (item.type === 'meetingpoint') {
      const coords = JSON.parse(item.body);
      return (
        <View style={[s.bubble, isMine ? s.mine : s.theirs]}>
          {isMine ? <View style={s.bubbleGlossMine} /> : <><View style={s.bubbleGlossTheirs} /><View style={s.bubbleShadeTheirs} /></>}
          <TouchableOpacity
            onPress={() => navigation.navigate('Map', {
              type:    'meetingpoint',
              meetLat: coords.meetLat / 1e6,
              meetLng: coords.meetLng / 1e6,
              fromLat: coords.fromLat / 1e6,
              fromLng: coords.fromLng / 1e6,
            })}
            style={s.specialCard}
          >
            <Text style={s.specialIcon}>🏴</Text>
            <Text style={isMine ? s.specialLabel : s.specialLabelTheirs}>
              Proposed a meeting point
            </Text>
            <Text style={isMine ? s.specialHint : s.specialHintTheirs}>
              Tap to open map
            </Text>
          </TouchableOpacity>
          <Text style={isMine ? s.meta : s.metaTheirs}>
            {item.from} · {new Date(item.ts).toLocaleTimeString()}
          </Text>
        </View>
      );
    }

    if (item.type === 'arrival') {
      const { message } = JSON.parse(item.body);
      const displayText = isMine
        ? 'You just arrived at your meeting point! 🎯'
        : message;
      return (
        <View style={s.arrivalBubble}>
          <Text style={s.arrivalText}>{displayText}</Text>
          <Text style={s.arrivalMeta}>{new Date(item.ts).toLocaleTimeString()}</Text>
        </View>
      );
    }

    return (
      <View style={[s.bubble, isMine ? s.mine : s.theirs]}>
        <View style={s.bubbleGloss} />
        <Text style={isMine ? s.body : s.bodyTheirs}>{item.body}</Text>
        <Text style={isMine ? s.meta : s.metaTheirs}>
          {item.from} · {new Date(item.ts).toLocaleTimeString()}
        </Text>
      </View>
    );
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
          renderItem={renderBubble}
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Text style={s.empty}>No messages yet.{'\n'}Say something! 🦋</Text>
            </View>
          }
        />
        <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 6) }]}>
          <View style={s.composerGloss} />
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message..."
            placeholderTextColor="#88BBCC"
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <TouchableOpacity style={s.sendBtn} onPress={send} activeOpacity={0.75}>
            <View style={s.sendBtnGloss} />
            <Text style={s.sendBtnText}>↑</Text>
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

  /* Standard bubble shell */
  bubble: { maxWidth: '72%', paddingHorizontal: 11, paddingVertical: 7 },

  /* Sent — right-aligned, green glass, bottom-right corner sharp */
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(34,170,78,0.82)',
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 4,
    borderWidth: 1, borderColor: 'rgba(60,210,100,0.38)',
    overflow: 'hidden',
    shadowColor: '#002810', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22, shadowRadius: 6, elevation: 3,
  },

  /* Received — left-aligned, white glass, bottom-left corner sharp */
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    borderBottomLeftRadius: 4, borderBottomRightRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(120,190,230,0.38)',
    overflow: 'hidden',
    shadowColor: '#0050A0', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09, shadowRadius: 5, elevation: 2,
  },

  bubbleGlossMine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  bubbleGlossTheirs: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '52%',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  bubbleShadeTheirs: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '38%',
    backgroundColor: 'rgba(160,210,255,0.14)',
  },

  body:       { color: '#fff',    fontSize: 13, lineHeight: 18 },
  bodyTheirs: { color: '#003366', fontSize: 13, lineHeight: 18 },
  meta:       { color: 'rgba(200,255,210,0.72)', fontSize: 10, marginTop: 3 },
  metaTheirs: { color: '#88BBCC',                fontSize: 10, marginTop: 3 },

  /* Location / meetingpoint tap card inside bubble */
  specialCard:  { alignItems: 'center', gap: 4, paddingVertical: 4, minWidth: 130 },
  specialIcon:  { fontSize: 26, textAlign: 'center' },
  specialLabel: { color: '#fff',    fontWeight: '700', fontSize: 13, textAlign: 'center' },
  specialLabelTheirs: { color: '#003366', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  specialHint:  { color: 'rgba(180,215,245,0.70)', fontSize: 11, textAlign: 'center' },
  specialHintTheirs:  { color: '#88BBCC', fontSize: 11, textAlign: 'center' },

  /* Arrival — centered green pill */
  arrivalBubble: {
    alignSelf: 'center', maxWidth: '86%',
    backgroundColor: 'rgba(39,174,96,0.22)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(104,211,145,0.38)',
    paddingHorizontal: 16, paddingVertical: 9,
    alignItems: 'center', gap: 3,
  },
  arrivalText: { color: '#68D391', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  arrivalMeta: { color: 'rgba(104,211,145,0.55)', fontSize: 10 },

  /* Wii input bar — matches BroadcastTab */
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
    flex: 1,
    minHeight: 38,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 19, borderWidth: 1, borderColor: 'rgba(100,170,220,0.42)',
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 13, color: '#003366', zIndex: 1,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#0077B6',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', zIndex: 1,
    shadowColor: '#001840', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22, shadowRadius: 5, elevation: 3,
  },
  sendBtnGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '44%',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderTopLeftRadius: 19, borderTopRightRadius: 19,
  },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '800', zIndex: 1 },

  /* Navigation header action buttons */
  headerBtns:    { flexDirection: 'row', marginRight: 8 },
  headerBtn:     { padding: 4, marginLeft: 4 },
  headerBtnText: { fontSize: 22 },
});
