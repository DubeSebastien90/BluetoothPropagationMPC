import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, Alert, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BleManager }  from './src/ble/BleManager';
import { MeshRouter }  from './src/mesh/MeshRouter';
import { NullCrypto }  from './src/mocks/NullCrypto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Derive a stable test pubkey from nickname — good enough for e2e testing
function testPubkey(nickname) {
  return nickname.toLowerCase().replace(/\s+/g, '-') + '-test-pubkey';
}

// ─── Setup screen ─────────────────────────────────────────────────────────────

function SetupScreen({ onConfirm }) {
  const [nickname, setNickname] = useState('');
  return (
    <View style={s.center}>
      <Text style={s.title}>Mesh Chat</Text>
      <Text style={s.subtitle}>Test Harness — Feature A + B</Text>
      <TextInput
        style={s.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder="Your nickname (e.g. alice)..."
        placeholderTextColor="#555"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity
        style={[s.btn, !nickname.trim() && s.btnDisabled]}
        onPress={() => nickname.trim() && onConfirm(nickname.trim())}
        disabled={!nickname.trim()}
      >
        <Text style={s.btnText}>Start</Text>
      </TouchableOpacity>
      <Text style={s.hint}>
        Use different nicknames on each phone.{'\n'}
        Each nickname gets a unique test identity.
      </Text>
    </View>
  );
}

// ─── Main test screen ─────────────────────────────────────────────────────────

function TestScreen({ identity }) {
  const insets                  = useSafeAreaInsets();
  const [peers, setPeers]       = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [status, setStatus]     = useState('starting...');
  const routerRef               = useRef(null);

  useEffect(() => {
    const crypto = new NullCrypto();

    const meshRouter = new MeshRouter(
      identity,
      null,
      crypto,
      (msg) => {
        console.log('[ROUTER] message for me:', msg);
        setMessages(prev => [msg, ...prev]);
      }
    );

    const transport = new BleManager({
      onPacketReceived: (packet, fromId) => {
        console.log('[BLE] packet received from', fromId, packet);
        meshRouter._handleIncoming(packet, fromId);
      },
      onPeerConnected: (deviceId, name) => {
        console.log('[BLE] peer connected:', name, deviceId);
        setPeers(prev => {
          if (prev.find(p => p.deviceId === deviceId)) return prev;
          return [...prev, { deviceId, name }];
        });
        setStatus(`${peers.length + 1} peer(s) connected`);
      },
      onPeerDisconnected: (deviceId) => {
        console.log('[BLE] peer disconnected:', deviceId);
        setPeers(prev => prev.filter(p => p.deviceId !== deviceId));
      },
    });

    meshRouter.transport = transport;
    routerRef.current = meshRouter;
    meshRouter.start();

    transport.start()
      .then(() => setStatus('scanning...'))
      .catch(e => {
        console.error('[BLE] start failed:', e);
        setStatus('BLE error: ' + e.message);
        Alert.alert('BLE Error', e.message);
      });

    return () => { transport.stop(); };
  }, []);

  const sendBroadcast = () => {
    if (!routerRef.current) return;
    const body = input.trim() || `hi from ${identity.nickname}`;
    console.log('[UI] sending broadcast:', body);
    routerRef.current.send('all', 'all', body);
    setMessages(prev => [{
      id:     Date.now().toString(),
      from:   identity.nickname,
      fromId: identity.pubkey,
      to:     'all',
      toId:   'all',
      body,
      ts:     Date.now(),
      _mine:  true,
    }, ...prev]);
    setInput('');
  };

  const sendToPeer = (peer) => {
    if (!routerRef.current) return;
    const body = input.trim() || `hi from ${identity.nickname}`;
    const toId = testPubkey(peer.name);
    console.log('[UI] sending direct to', peer.name, toId, ':', body);
    routerRef.current.send(peer.name, toId, body);
    setMessages(prev => [{
      id:     Date.now().toString(),
      from:   identity.nickname,
      fromId: identity.pubkey,
      to:     peer.name,
      toId,
      body,
      ts:     Date.now(),
      _mine:  true,
    }, ...prev]);
    setInput('');
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerName}>{identity.nickname}</Text>
        <Text style={s.headerId} numberOfLines={1}>
          id: {identity.pubkey}
        </Text>
        <Text style={s.headerStatus}>
          {peers.length === 0
            ? `📡 ${status}`
            : `🔗 ${peers.length} peer${peers.length > 1 ? 's' : ''} connected`}
        </Text>
      </View>

      {/* Peer list + direct send buttons */}
      {peers.length > 0 && (
        <View style={s.peerBar}>
          {peers.map(p => (
            <TouchableOpacity
              key={p.deviceId}
              style={s.peerBtn}
              onPress={() => sendToPeer(p)}
            >
              <Text style={s.peerBtnText}>→ {p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Message list */}
      <FlatList
        style={s.messages}
        data={messages}
        keyExtractor={(m, i) => m.id ?? i.toString()}
        renderItem={({ item }) => (
          <View style={[s.bubble, item._mine ? s.mine : s.theirs]}>
            <Text style={s.body}>{item.body}</Text>
            <Text style={s.meta}>
              {item.from} → {item.to} · {new Date(item.ts).toLocaleTimeString()}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={s.empty}>
            No messages yet.{'\n'}
            Press Broadcast to send to all peers.{'\n'}
            Tap a peer button to send directly.
          </Text>
        }
      />

      {/* Composer */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.composer}>
          <TextInput
            style={s.composerInput}
            value={input}
            onChangeText={setInput}
            placeholder="Message (optional)..."
            placeholderTextColor="#555"
          />
          <TouchableOpacity
            style={[s.broadcastBtn, peers.length === 0 && s.btnDisabled]}
            onPress={sendBroadcast}
            disabled={peers.length === 0}
          >
            <Text style={s.broadcastBtnText}>Broadcast</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <View style={{ height: insets.bottom }} />
    </SafeAreaView>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [identity, setIdentity] = useState(null);

  if (!identity) {
    return (
      <SafeAreaProvider>
        <SetupScreen
          onConfirm={(nickname) =>
            setIdentity({ nickname, pubkey: testPubkey(nickname) })
          }
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <TestScreen identity={identity} />
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Setup
  center: {
    flex: 1, backgroundColor: '#0a0a1a',
    alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16,
  },
  title:    { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  subtitle: { color: '#555', fontSize: 14 },
  hint:     { color: '#333', fontSize: 12, textAlign: 'center', marginTop: 8 },
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
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Main
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  header: {
    padding: 16, borderBottomWidth: 1, borderColor: '#1a1a1a',
  },
  headerName:   { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerId:     { color: '#333', fontSize: 10, marginTop: 2 },
  headerStatus: { color: '#555', fontSize: 13, marginTop: 4 },

  peerBar: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, paddingVertical: 8,
    gap: 8, borderBottomWidth: 1, borderColor: '#1a1a1a',
  },
  peerBtn: {
    backgroundColor: '#1a1a2e', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  peerBtnText: { color: '#2563eb', fontSize: 13, fontWeight: '600' },

  messages: { flex: 1, padding: 12 },
  empty: {
    color: '#333', textAlign: 'center',
    marginTop: 60, lineHeight: 22,
  },
  bubble: {
    marginBottom: 10, padding: 10,
    borderRadius: 12, maxWidth: '80%',
  },
  mine:   { backgroundColor: '#1e3a5f', alignSelf: 'flex-end' },
  theirs: { backgroundColor: '#1a1a1a', alignSelf: 'flex-start' },
  body:   { color: '#fff', fontSize: 15 },
  meta:   { color: '#555', fontSize: 11, marginTop: 4 },

  composer: {
    flexDirection: 'row', padding: 12,
    borderTopWidth: 1, borderColor: '#1a1a1a', gap: 8,
  },
  composerInput: {
    flex: 1, backgroundColor: '#111', color: '#fff',
    borderRadius: 8, padding: 10, fontSize: 14,
  },
  broadcastBtn: {
    backgroundColor: '#2563eb', borderRadius: 8,
    paddingHorizontal: 14, justifyContent: 'center',
  },
  broadcastBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});
