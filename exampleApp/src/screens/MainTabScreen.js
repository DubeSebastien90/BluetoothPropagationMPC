import React, { useState, useRef } from 'react';
import {
  View, Text, FlatList, SectionList, TextInput, TouchableOpacity,
  StyleSheet, Alert, Image, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useApp } from '../state/AppContext';
import { encodeIdentityForQR, decodeIdentityFromQR } from '../contracts/IdentityContract';

const LOGO   = require('../../assets/toot_logo.png');
const NO_ONE = require('../../assets/toot_no_one.png');

const ORB_TINTS = [
  'rgba(200, 50,  20, 0.38)',
  'rgba( 30, 150,  50, 0.38)',
  'rgba(130,  40, 220, 0.38)',
  'rgba(220, 130,   0, 0.38)',
  'rgba(  0, 160, 160, 0.38)',
  'rgba(  0, 100, 180, 0.38)',
];
function orbColor(nickname) {
  return ORB_TINTS[(nickname.charCodeAt(0) || 0) % ORB_TINTS.length];
}

const TABS = [
  { label: 'Contacts', icon: '💬' },
  { label: 'Add',      icon: '👥' },
  { label: 'Nearby',   icon: '📡' },
  { label: 'Me',       icon: '◉'  },
];
const HEADER_TITLES = ['toot', 'Add Friend', 'Nearby', 'My Profile'];


/* ═══════════════════════════════════════════════════════════════
   TAB 1 — CONTACTS
═══════════════════════════════════════════════════════════════ */
function ContactsTab({ navigation }) {
  const { state, dispatch } = useApp();

  const confirmDelete = (contact) =>
    Alert.alert(
      'Remove contact',
      `Remove ${contact.nickname} from your contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: () => dispatch({ type: 'REMOVE_CONTACT', payload: contact.pubkey }),
        },
      ]
    );

  const confirmUnsubscribe = (topicName) =>
    Alert.alert(
      'Leave topic',
      `Unsubscribe from "#${topicName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive',
          onPress: () => dispatch({ type: 'UNSUBSCRIBE_TOPIC', payload: topicName }),
        },
      ]
    );

  const sections = [
    { key: 'topics',   title: 'Topics',   data: state.topics },
    { key: 'contacts', title: 'Contacts', data: state.contacts },
  ];
  const isEmpty = state.topics.length === 0 && state.contacts.length === 0;

  if (isEmpty) {
    return (
      <View style={ct.emptyContainer}>
        <View style={ct.emptyBox}>
          <Image source={NO_ONE} style={ct.emptyImg} resizeMode="contain" />
          <Text style={ct.emptyTitle}>Nothing here yet</Text>
          <Text style={ct.emptyBody}>
            Go to Add to scan someone's QR code, or subscribe to a topic.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item, i) => (typeof item === 'string' ? item : item.pubkey) ?? String(i)}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={ct.listContent}
      renderSectionHeader={({ section }) => (
        <View style={ct.sectionHeader}>
          <Text style={ct.sectionTitle}>{section.title}</Text>
          {section.key === 'topics' && (
            <TouchableOpacity
              onPress={() => navigation.navigate('SubscribeTopic')}
              style={ct.sectionActionBtn}
              activeOpacity={0.75}
            >
              <Text style={ct.sectionActionText}>+ Subscribe</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      renderItem={({ item, section }) => {
        if (section.key === 'topics') {
          return (
            <TouchableOpacity
              style={ct.row}
              onPress={() => navigation.navigate('TopicChat', { topicName: item })}
              onLongPress={() => confirmUnsubscribe(item)}
              activeOpacity={0.80}
            >
              <View style={ct.rowGloss} />
              <View style={[ct.orb, { backgroundColor: 'rgba(0,160,160,0.38)' }]}>
                <Text style={ct.orbText}>#</Text>
                <View style={ct.orbReflet} />
              </View>
              <View style={ct.rowMid}>
                <Text style={ct.rowName}>{item}</Text>
                <Text style={ct.rowSub}>Topic channel</Text>
              </View>
              <Text style={ct.rowChevron}>›</Text>
            </TouchableOpacity>
          );
        }

        const isOnline = state.peers.some(p => p.name === item.nickname);
        return (
          <TouchableOpacity
            style={ct.row}
            onPress={() => navigation.navigate('Chat', { contact: item })}
            onLongPress={() => confirmDelete(item)}
            activeOpacity={0.80}
          >
            <View style={ct.rowGloss} />
            <View style={[ct.orb, { backgroundColor: orbColor(item.nickname) }]}>
              <Text style={ct.orbText}>{item.nickname.slice(0, 1).toUpperCase()}</Text>
              <View style={ct.orbReflet} />
              {isOnline && <View style={ct.onlineDot} />}
            </View>
            <View style={ct.rowMid}>
              <Text style={ct.rowName}>{item.nickname}</Text>
              <Text style={ct.rowSub} numberOfLines={1} ellipsizeMode="middle">
                {item.pubkey}
              </Text>
            </View>
            <Text style={ct.rowChevron}>›</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const ct = StyleSheet.create({
  listContent:    { paddingBottom: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyBox:  { alignItems: 'center', padding: 40, gap: 12 },
  emptyImg:  { width: 210, height: 180, opacity: 0.88 },
  emptyTitle:{ color: '#fff', fontSize: 20, fontWeight: '800' },
  emptyBody: {
    color: 'rgba(255,255,255,0.58)', fontSize: 14,
    textAlign: 'center', lineHeight: 21,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8, gap: 8,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(100,180,230,0.20)',
    position: 'relative', overflow: 'hidden',
  },
  rowGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '52%',
    backgroundColor: 'rgba(255,255,255,0.48)',
    pointerEvents: 'none',
  },

  orb: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.52)',
    overflow: 'hidden', flexShrink: 0,
  },
  orbText:   { color: '#fff', fontSize: 15, fontWeight: '800', zIndex: 1 },
  orbReflet: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '42%',
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 16, paddingBottom: 5,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.3,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.42)',
  },
  sectionActionBtn: {
    backgroundColor: 'rgba(255,255,255,0.90)', borderRadius: 9999,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  sectionActionText: { fontSize: 11, fontWeight: '800', color: '#004E92' },

  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 11, height: 11, borderRadius: 5.5,
    backgroundColor: '#38A169', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.93)',
  },

  rowMid:    { flex: 1, minWidth: 0 },
  rowName:   { color: '#003366', fontSize: 13, fontWeight: '800' },
  rowSub:    { color: '#4488AA', fontSize: 11, marginTop: 1 },
  rowChevron:{ color: '#88BBCC', fontSize: 18 },
});


/* ═══════════════════════════════════════════════════════════════
   TAB 2 — ADD FRIEND
═══════════════════════════════════════════════════════════════ */
function AddFriendTab() {
  const { state, dispatch } = useApp();
  const [showScan, setShowScan] = useState(false);
  const [scanned,  setScanned]  = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const identity = state.identity;
  const qrValue  = identity ? encodeIdentityForQR(identity) : null;

  const handleScan = ({ data }) => {
    if (scanned) return;
    setScanned(true);

    const contact = decodeIdentityFromQR(data);
    if (!contact) {
      Alert.alert('Invalid QR', 'Not a valid Toot contact.', [
        { text: 'Try again', onPress: () => setScanned(false) },
      ]);
      return;
    }
    if (contact.pubkey === state.identity?.pubkey) {
      Alert.alert("That's you!", 'You scanned your own QR code.', [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
      return;
    }
    state.crypto?.registerPeerKey(contact.pubkey, contact.nickname);
    dispatch({ type: 'ADD_CONTACT', payload: contact });
    if (state.router) state.router.sendContactRequest(contact);
    Alert.alert(
      'Contact added!',
      `${contact.nickname} has been added.`,
      [{ text: 'Great 🦋', onPress: () => { setShowScan(false); setScanned(false); } }]
    );
  };

  /* ── Camera view ── */
  if (showScan) {
    if (!permission) return null;
    if (!permission.granted) {
      return (
        <View style={af.permBox}>
          <Text style={af.permTitle}>Camera needed</Text>
          <Text style={af.permBody}>Allow camera access to scan QR codes.</Text>
          <TouchableOpacity style={af.glassBtn} onPress={requestPermission} activeOpacity={0.75}>
            <Text style={af.glassBtnText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowScan(false)}>
            <Text style={af.cancelLink}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={af.cameraContainer}>
        <CameraView
          style={af.camera}
          onBarcodeScanned={handleScan}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        {/* Bottom overlay */}
        <View style={af.cameraBar}>
          <TouchableOpacity
            style={af.cancelBtn}
            onPress={() => { setShowScan(false); setScanned(false); }}
            activeOpacity={0.75}
          >
            <Text style={af.cancelBtnText}>✕  Cancel</Text>
          </TouchableOpacity>
          <Text style={af.cameraHint}>Point at a friend's QR code</Text>
        </View>
      </View>
    );
  }

  /* ── Normal view: QR + scan button ── */
  return (
    <View style={af.container}>

      {/* ── My QR code ── */}
      <Text style={af.sectionLabel}>your code</Text>
      <View style={af.qrCard}>
        <View style={af.qrCardReflet} />
        <View style={af.qrWrap}>
          {qrValue && (
            <QRCode
              value={qrValue}
              size={160}
              backgroundColor="#fff"
              color="#004E92"
            />
          )}
        </View>
        <Text style={af.qrCaption}>Show this to a friend 🦋</Text>
      </View>

      {/* ── Divider ── */}
      <View style={af.divider}>
        <View style={af.dividerLine} />
        <Text style={af.dividerText}>or</Text>
        <View style={af.dividerLine} />
      </View>

      {/* ── Scan button ── */}
      <TouchableOpacity
        style={af.scanBtn}
        onPress={() => setShowScan(true)}
        activeOpacity={0.75}
      >
        <View style={af.scanBtnGloss} />
        <Text style={af.scanBtnIcon}>📷</Text>
        <Text style={af.scanBtnText}>Scan a friend's QR code</Text>
      </TouchableOpacity>

    </View>
  );
}

const af = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center',
    paddingHorizontal: 28, paddingVertical: 20,
    alignItems: 'center',
  },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.4,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.52)',
    marginBottom: 12,
  },

  qrCard: {
    alignSelf: 'stretch',
    borderRadius: 18,
    padding: 20, alignItems: 'center', gap: 14,
    overflow: 'hidden',
  },
  qrCardReflet: {
    position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.90)', borderRadius: 9999,
  },
  qrWrap: {
    backgroundColor: '#fff', padding: 12, borderRadius: 12,
    shadowColor: '#001840', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  qrCaption: { color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: '700' },

  divider: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'stretch', marginVertical: 20, gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' },
  dividerText: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '700' },

  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, alignSelf: 'stretch', paddingVertical: 15, paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.50)',
    overflow: 'hidden',
    shadowColor: '#001840', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 4,
  },
  scanBtnGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  scanBtnIcon: { fontSize: 18, zIndex: 1 },
  scanBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', zIndex: 1 },

  /* Camera */
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  cameraBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: 'rgba(0,18,54,0.82)',
  },
  cancelBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)',
  },
  cancelBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cameraHint:    { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '600' },

  /* Permission */
  permBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 40, gap: 16,
  },
  permTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  permBody:  { color: 'rgba(255,255,255,0.58)', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  glassBtn: {
    paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.50)',
  },
  glassBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  cancelLink:   { color: 'rgba(255,255,255,0.42)', fontSize: 13 },
});


/* ═══════════════════════════════════════════════════════════════
   TAB 3 — BROADCAST  (Nearby)
═══════════════════════════════════════════════════════════════ */
function BroadcastTab() {
  const { state, dispatch } = useApp();
  const [input, setInput]   = useState('');
  const listRef             = useRef(null);
  const insets              = useSafeAreaInsets();

  const broadcasts = state.messages.filter(m => m.toId === 'all');

  const send = () => {
    if (!input.trim() || !state.router) return;
    const body = input.trim();
    state.router.send('all', 'all', body);
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id:     Date.now().toString(),
        from:   state.identity.nickname,
        fromId: state.identity.pubkey,
        to:     'all',
        toId:   'all',
        body,
        ts:     Date.now(),
      },
    });
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView
      style={bc.flex}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 108 : 66 + insets.bottom}
    >
      <FlatList
        ref={listRef}
        data={broadcasts}
        keyExtractor={m => m.id}
        contentContainerStyle={bc.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={bc.emptyBox}>
            <Text style={bc.emptyTitle}>No broadcasts yet</Text>
            <Text style={bc.emptyBody}>
              Send a message to everyone in the mesh.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.fromId === state.identity?.pubkey;
          return (
            <View style={[bc.bubble, mine ? bc.bubbleMine : bc.bubbleThem]}>
              {!mine && <Text style={bc.bubbleSender}>{item.from}</Text>}
              <Text style={mine ? bc.bodyMine : bc.bodyThem}>{item.body}</Text>
              <Text style={mine ? bc.metaMine : bc.metaThem}>
                {new Date(item.ts).toLocaleTimeString()}
              </Text>
            </View>
          );
        }}
      />

      {/* Wii input bar */}
      <View style={bc.inputBar}>
        <View style={bc.inputBarGloss} />
        <TextInput
          style={bc.input}
          value={input}
          onChangeText={setInput}
          placeholder="Broadcast to everyone..."
          placeholderTextColor="#88BBCC"
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <TouchableOpacity style={bc.sendBtn} onPress={send} activeOpacity={0.75}>
          <View style={bc.sendBtnGloss} />
          <Text style={bc.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const bc = StyleSheet.create({
  flex: { flex: 1 },
  listContent: {
    flexGrow: 1, padding: 10, gap: 6, justifyContent: 'flex-end',
  },
  emptyBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 40, gap: 10,
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  emptyBody:  {
    color: 'rgba(255,255,255,0.52)', fontSize: 14,
    textAlign: 'center', lineHeight: 21,
  },

  bubble:     { maxWidth: '72%', paddingHorizontal: 11, paddingVertical: 7 },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#0077B6',
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 4,
    borderWidth: 1, borderColor: 'rgba(0,150,210,0.32)',
    shadowColor: '#001840', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 5, elevation: 3,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    borderBottomLeftRadius: 4, borderBottomRightRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(120,190,230,0.38)',
    shadowColor: '#0050A0', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09, shadowRadius: 5, elevation: 2,
  },
  bubbleSender: { color: '#4488AA', fontSize: 10, fontWeight: '700', marginBottom: 2 },
  bodyMine:  { color: '#fff',    fontSize: 13, lineHeight: 18 },
  bodyThem:  { color: '#003366', fontSize: 13, lineHeight: 18 },
  metaMine:  { color: 'rgba(180,215,245,0.70)', fontSize: 10, marginTop: 3 },
  metaThem:  { color: '#88BBCC',                fontSize: 10, marginTop: 3 },

  /* Wii input bar */
  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 6, gap: 6,
    backgroundColor: 'rgba(210,235,255,0.94)',
    borderTopWidth: 1, borderTopColor: 'rgba(100,170,220,0.35)',
    overflow: 'hidden',
  },
  inputBarGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '55%',
    backgroundColor: 'rgba(255,255,255,0.46)',
  },
  input: {
    flex: 1,
    minHeight: 38,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 19,
    borderWidth: 1, borderColor: 'rgba(100,170,220,0.42)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: '#003366',
    zIndex: 1,
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
});


/* ═══════════════════════════════════════════════════════════════
   TAB 4 — PROFILE
═══════════════════════════════════════════════════════════════ */
function ProfileTab({ onDeleteAccount }) {
  const { state } = useApp();
  const { identity } = state;

  if (!identity) return null;

  const confirmDelete = () =>
    Alert.alert(
      'Delete account',
      'This will wipe your identity, keypair, and all contacts. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDeleteAccount },
      ]
    );

  return (
    <ScrollView
      style={pr.scroll}
      contentContainerStyle={pr.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Big orb */}
      <View style={[pr.bigOrb, { backgroundColor: orbColor(identity.nickname) }]}>
        <Text style={pr.bigOrbText}>{identity.nickname.slice(0, 1).toUpperCase()}</Text>
        <View style={pr.bigOrbReflet} />
      </View>

      <Text style={pr.name}>{identity.nickname}</Text>
      <Text style={pr.pubkey} numberOfLines={2} ellipsizeMode="middle">
        {identity.pubkey}
      </Text>

      {/* Stats card — Wii white */}
      <View style={pr.card}>
        <View style={pr.cardGloss} />
        <Text style={pr.cardLabel}>bluetooth</Text>

        <View style={pr.statRow}>
          <Text style={pr.statKey}>Status</Text>
          <Text style={pr.statActive}>● Active</Text>
        </View>
        <View style={pr.statRow}>
          <Text style={pr.statKey}>Peers nearby</Text>
          <Text style={pr.statVal}>{state.peers.length}</Text>
        </View>
        <View style={[pr.statRow, { borderBottomWidth: 0 }]}>
          <Text style={pr.statKey}>Contacts</Text>
          <Text style={pr.statVal}>{state.contacts.length}</Text>
        </View>
      </View>

      {/* Delete */}
      <TouchableOpacity style={pr.deleteBtn} onPress={confirmDelete} activeOpacity={0.75}>
        <Text style={pr.deleteBtnText}>Delete account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const pr = StyleSheet.create({
  scroll: { flex: 1 },
  container: {
    alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32, gap: 14,
  },

  bigOrb: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.50)',
    overflow: 'hidden',
    shadowColor: '#001840', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 14, elevation: 6,
  },
  bigOrbText:   { color: '#fff', fontSize: 30, fontWeight: '800', zIndex: 1 },
  bigOrbReflet: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '42%',
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderTopLeftRadius: 40, borderTopRightRadius: 40,
  },

  name:   { color: '#fff', fontSize: 26, fontWeight: '900' },
  pubkey: {
    color: 'rgba(255,255,255,0.38)', fontSize: 11,
    textAlign: 'center', maxWidth: 280, lineHeight: 17,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },

  /* Wii white stats card */
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.91)',
    borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(200,235,255,0.65)',
    padding: 16, overflow: 'hidden',
    shadowColor: '#001840', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14, shadowRadius: 8, elevation: 3,
  },
  cardGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '48%',
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  cardLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.3,
    textTransform: 'uppercase', color: '#88BBCC', marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(100,180,230,0.18)',
  },
  statKey:    { color: '#4488AA', fontSize: 14 },
  statVal:    { color: '#003366', fontSize: 14, fontWeight: '800' },
  statActive: { color: '#27AE60', fontSize: 14, fontWeight: '800' },

  deleteBtn: {
    marginTop: 10, paddingVertical: 11, paddingHorizontal: 28,
    borderRadius: 9999,
    borderWidth: 1, borderColor: 'rgba(255,100,100,0.38)',
    backgroundColor: 'rgba(255,80,80,0.07)',
  },
  deleteBtnText: { color: '#FF6B6B', fontSize: 14, fontWeight: '700' },
});


/* ═══════════════════════════════════════════════════════════════
   BOTTOM NAV BAR
═══════════════════════════════════════════════════════════════ */
function BottomNav({ activeTab, setActiveTab }) {
  return (
    <View style={nb.bar}>
      {/* Top gloss line */}
      <View style={nb.barGloss} />

      {TABS.map((tab, i) => {
        const active = i === activeTab;
        return (
          <TouchableOpacity
            key={i}
            style={nb.item}
            onPress={() => setActiveTab(i)}
            activeOpacity={0.7}
          >
            <View style={[nb.btn, active && nb.btnActive]}>
              <View style={nb.btnGloss} />
              <Text style={nb.btnIcon}>{tab.icon}</Text>
            </View>
            <Text style={[nb.label, active && nb.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const nb = StyleSheet.create({
  bar: {
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(160,215,245,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(80,150,210,0.32)',
    shadowColor: '#001840', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 8,
  },
  barGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '52%',
    backgroundColor: 'rgba(255,255,255,0.30)',
  },

  item: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 2, paddingVertical: 4, zIndex: 1,
  },
  btn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  btnActive: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#003070',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  btnGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '44%',
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
  },
  btnIcon: { fontSize: 18, zIndex: 1 },

  label:      { fontSize: 10, fontWeight: '600', color: 'rgba(0,60,120,0.52)' },
  labelActive:{ fontSize: 10, fontWeight: '900', color: '#003F80' },
});


/* ═══════════════════════════════════════════════════════════════
   MAIN SHELL
═══════════════════════════════════════════════════════════════ */
export function MainTabScreen({ navigation, onDeleteAccount }) {
  const [activeTab, setActiveTab] = useState(0);
  const { state } = useApp();

  return (
    <LinearGradient
      colors={['#004E92', '#0077B6', '#00B4D8', '#48CAE4', '#ADE8F4', '#CAF0F8']}
      locations={[0, 0.18, 0.42, 0.65, 0.85, 1.0]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={s.shell}
    >

      {/* ── Wii-style header ── */}
      <SafeAreaView edges={['top']} style={s.headerSafe}>
        <View style={s.header}>
          <View style={s.headerGloss} />

          {activeTab === 0 ? (
            <>
              <Image source={LOGO} style={s.logo} resizeMode="contain" />
              <Text style={s.headerTitle} numberOfLines={1}>
                {state.identity?.nickname ?? 'toot'}
              </Text>
              <View style={s.peerPill}>
                <Text style={s.peerPillText}>
                  {state.peers.length === 0
                    ? '📡'
                    : `🔗 ${state.peers.length}`}
                </Text>
              </View>
            </>
          ) : (
            <Text style={s.headerTitleCenter}>{HEADER_TITLES[activeTab]}</Text>
          )}
        </View>
      </SafeAreaView>

      {/* ── Tab content ── */}
      <View style={s.content}>
        {activeTab === 0 && <ContactsTab  navigation={navigation} />}
        {activeTab === 1 && <AddFriendTab navigation={navigation} />}
        {activeTab === 2 && <BroadcastTab />}
        {activeTab === 3 && <ProfileTab   onDeleteAccount={onDeleteAccount} />}
      </View>

      {/* ── Bottom nav ── */}
      <SafeAreaView edges={['bottom']} style={s.navSafe}>
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </SafeAreaView>

    </LinearGradient>
  );
}

const s = StyleSheet.create({
  shell: { flex: 1 },

  /* Wii header */
  headerSafe: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(100,180,240,0.42)',
    shadowColor: '#003070',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  header: {
    height: 44,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, gap: 8, overflow: 'hidden',
  },
  headerGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '55%',
    backgroundColor: 'rgba(255,255,255,0.52)',
  },
  logo:  { width: 32, height: 32, borderRadius: 8, zIndex: 1 },
  headerTitle: {
    flex: 1, color: '#004E92', fontSize: 18, fontWeight: '900', zIndex: 1,
  },
  headerTitleCenter: {
    flex: 1, textAlign: 'center',
    color: '#004E92', fontSize: 17, fontWeight: '900', zIndex: 1,
  },
  peerPill: {
    backgroundColor: 'rgba(0,78,146,0.10)',
    borderRadius: 9999,
    borderWidth: 1, borderColor: 'rgba(0,119,182,0.28)',
    paddingHorizontal: 10, paddingVertical: 3, zIndex: 1,
  },
  peerPillText: { color: '#0077B6', fontSize: 12, fontWeight: '700' },

  content: { flex: 1 },

  /* Nav safe area matches nav bar colour */
  navSafe: { backgroundColor: 'rgb(160,215,245)' },
});
