import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, useApp }       from './src/state/AppContext';
import { AppNavigator }              from './src/navigation/AppNavigator';
import { SetupScreen, IDENTITY_KEY } from './src/screens/SetupScreen';
import { BleManager }                from './src/ble/BleManager';
import { MeshRouter }                from './src/mesh/MeshRouter';
import { PeerManager }               from './src/mesh/peerManager';
import { RealCrypto }                from './src/crypto/RealCrypto';
import { ContactNotifModal }         from './src/components/ContactNotifModal';
import { MeetingPointTracker }       from './src/services/MeetingPointTracker';

const CONTACTS_KEY = 'contacts_v1';
const TOPICS_KEY   = 'topics_v1';

const LOGO = require('./assets/toot_logo.png');

const GRADIENT = {
  colors: ['#004E92', '#0077B6', '#00B4D8', '#48CAE4', '#ADE8F4', '#CAF0F8'],
  locations: [0, 0.18, 0.42, 0.65, 0.85, 1.0],
  start: { x: 0.5, y: 0 },
  end:   { x: 0.5, y: 1 },
};

function AppInner() {
  const { state, dispatch } = useApp();
  const [initError, setInitError]       = useState(null);
  const [deleted, setDeleted]           = useState(false);
  const [contactNotif, setContactNotif] = useState(null);
  const transportRef                    = useRef(null);
  const stateRef                        = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Step 1: Initialise crypto on launch ─────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const crypto = new RealCrypto();
      const { pubkey } = await crypto.initialize();
      dispatch({ type: 'SET_CRYPTO', payload: crypto });

      const storedIdentity = await AsyncStorage.getItem(IDENTITY_KEY);
      if (storedIdentity) {
        const identity = JSON.parse(storedIdentity);

        if (identity.pubkey !== pubkey) {
          // Pubkey mismatch — old NullCrypto data or rotated keypair. Start fresh.
          console.log('[APP] pubkey mismatch — clearing old identity data');
          await AsyncStorage.multiRemove([IDENTITY_KEY, CONTACTS_KEY]);
          return;
        }

        dispatch({ type: 'SET_IDENTITY', payload: identity });

        const storedContacts = await AsyncStorage.getItem(CONTACTS_KEY);
        if (storedContacts) {
          const contacts = JSON.parse(storedContacts);
          contacts.forEach(c => crypto.registerPeerKey(c.pubkey, c.nickname));
          dispatch({ type: 'SET_CONTACTS', payload: contacts });
        }

        const storedTopics = await AsyncStorage.getItem(TOPICS_KEY);
        if (storedTopics) {
          dispatch({ type: 'SET_TOPICS', payload: JSON.parse(storedTopics) });
        }
      }
    };

    init().catch(e => {
      console.error('[APP] init failed:', e);
      setInitError(e.message);
    });
  }, []);

  // ── Step 2: Persist contacts + topics whenever they change ──────────────────
  useEffect(() => {
    if (!state.identity) return;
    AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(state.contacts))
      .catch(e => console.warn('[APP] contacts save failed:', e));
  }, [state.contacts]);

  useEffect(() => {
    if (!state.identity) return;
    AsyncStorage.setItem(TOPICS_KEY, JSON.stringify(state.topics))
      .catch(e => console.warn('[APP] topics save failed:', e));
  }, [state.topics]);

  // ── Step 3: Start BLE once identity + crypto are both ready ─────────────────
  useEffect(() => {
    if (!state.identity || !state.crypto) return;

    const peerManager = new PeerManager((peers) =>
      dispatch({ type: 'SET_PEERS', payload: peers })
    );

    const meshRouter = new MeshRouter(
      state.identity,
      null,
      state.crypto,
      (message) => {
        dispatch({ type: 'ADD_MESSAGE', payload: message });
        if (message.type === 'meetingpoint') {
          try {
            const coords = JSON.parse(message.body);
            dispatch({
              type: 'ADD_MEETING_POINT',
              payload: {
                id:               message.id,
                contactPubkey:    message.fromId,
                contactNickname:  message.from,
                meetLat:          coords.meetLat / 1e6,
                meetLng:          coords.meetLng / 1e6,
                arrived:          false,
              },
            });
          } catch (e) {
            console.warn('[APP] failed to parse meeting point:', e.message);
          }
        }
      },
      (contact, type) => {
        console.log('[APP] contact_req/ack received — auto-adding:', contact.nickname, type);
        state.crypto.registerPeerKey(contact.pubkey, contact.nickname);
        dispatch({ type: 'ADD_CONTACT', payload: contact });
        if (type === 'contact_req') setContactNotif({ ...contact, type });
      }
    );

    const transport = new BleManager({
      onPacketReceived:   (packet, fromId) => meshRouter._handleIncoming(packet, fromId),
      onPeerConnected:    (id, name)       => peerManager.onPeerConnected(id, name),
      onPeerDisconnected: (id)             => peerManager.onPeerDisconnected(id),
    });

    meshRouter.transport = transport;
    meshRouter.start();
    dispatch({ type: 'SET_ROUTER', payload: meshRouter });

    transportRef.current = transport;
    transport.start().catch(e => console.error('[BLE] start failed:', e));

    const tracker = new MeetingPointTracker({
      getState:  () => stateRef.current,
      onArrived: (id)  => dispatch({ type: 'MARK_ARRIVED', payload: id }),
      onMessage: (msg) => dispatch({ type: 'ADD_MESSAGE', payload: msg }),
    });
    tracker.start();

    return () => {
      transport.stop();
      transportRef.current = null;
      tracker.stop();
    };
  }, [state.identity, state.crypto]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (deleted) {
    return (
      <LinearGradient {...GRADIENT} style={s.shell}>
        <SafeAreaView style={s.center}>
          <View style={s.infoCard}>
            <View style={s.infoCardGloss} />
            <Ionicons name="trash" size={40} color="rgba(255,255,255,0.90)" />
            <Text style={s.infoTitle}>Account deleted</Text>
            <Text style={s.infoBody}>
              Close and reopen the app to reconnect.
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (initError) {
    return (
      <LinearGradient {...GRADIENT} style={s.shell}>
        <SafeAreaView style={s.center}>
          <View style={s.infoCard}>
            <View style={s.infoCardGloss} />
            <Ionicons name="warning" size={40} color="rgba(255,255,255,0.90)" />
            <Text style={s.infoTitle}>Startup error</Text>
            <Text style={s.infoBody}>{initError}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!state.crypto) {
    return (
      <LinearGradient {...GRADIENT} style={s.shell}>
        <SafeAreaView style={s.center}>
          <Image source={LOGO} style={s.loadingLogo} resizeMode="contain" />
          <ActivityIndicator size="large" color="rgba(255,255,255,0.80)" />
          <Text style={s.loadingText}>Initialising...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const deleteAccount = async () => {
    console.log('[APP] deleting account...');
    transportRef.current?.stop();
    await AsyncStorage.multiRemove([IDENTITY_KEY, CONTACTS_KEY, TOPICS_KEY, 'keypair_v1']);
    setDeleted(true);
    dispatch({ type: 'RESET' });
  };

  if (!state.identity) return <SetupScreen />;

  return (
    <>
      <AppNavigator onDeleteAccount={deleteAccount} />
      <ContactNotifModal
        notif={contactNotif}
        onDismiss={() => setContactNotif(null)}
      />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppInner />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  shell:  { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 },

  loadingLogo: { width: 72, height: 72, borderRadius: 20, marginBottom: 4 },
  loadingText: { color: 'rgba(255,255,255,0.72)', fontSize: 14, fontWeight: '600' },

  infoCard: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.40)',
    padding: 28, alignItems: 'center', gap: 10, overflow: 'hidden',
    shadowColor: '#001840', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16, shadowRadius: 12, elevation: 4,
  },
  infoCardGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  infoTitle: { color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  infoBody:  {
    color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 22,
    textAlign: 'center',
  },
});
