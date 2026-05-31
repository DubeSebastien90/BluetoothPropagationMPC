import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, useApp }       from './src/state/AppContext';
import { AppNavigator }              from './src/navigation/AppNavigator';
import { SetupScreen, IDENTITY_KEY } from './src/screens/SetupScreen';
import { BleManager }                from './src/ble/BleManager';
import { MeshRouter }                from './src/mesh/MeshRouter';
import { PeerManager }               from './src/mesh/peerManager';
import { RealCrypto }                from './src/crypto/RealCrypto';
import { ContactNotifModal }         from './src/components/ContactNotifModal';

const CONTACTS_KEY = 'contacts_v1';
const GROUPS_KEY   = 'groups_v1';

function AppInner() {
  const { state, dispatch } = useApp();
  const [initError, setInitError]       = useState(null);
  const [contactNotif, setContactNotif] = useState(null);
  const [groupNotif, setGroupNotif]     = useState(null);
  const transportRef                    = useRef(null);
  const groupsRef                       = useRef([]);

  // Keep groupsRef current every render so router closures never go stale
  groupsRef.current = state.groups;

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

        const storedGroups = await AsyncStorage.getItem(GROUPS_KEY);
        if (storedGroups) {
          dispatch({ type: 'SET_GROUPS', payload: JSON.parse(storedGroups) });
        }
      }
    };

    init().catch(e => {
      console.error('[APP] init failed:', e);
      setInitError(e.message);
    });
  }, []);

  // ── Step 2: Persist contacts + groups whenever they change ──────────────────
  useEffect(() => {
    if (!state.identity) return;
    AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(state.contacts))
      .catch(e => console.warn('[APP] contacts save failed:', e));
  }, [state.contacts]);

  useEffect(() => {
    if (!state.identity) return;
    AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(state.groups))
      .catch(e => console.warn('[APP] groups save failed:', e));
  }, [state.groups]);

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
      (message) => dispatch({ type: 'ADD_MESSAGE', payload: message }),
      (contact, type) => {
        console.log('[APP] contact_req/ack received — auto-adding:', contact.nickname, type);
        state.crypto.registerPeerKey(contact.pubkey, contact.nickname);
        dispatch({ type: 'ADD_CONTACT', payload: contact });
        setContactNotif({ ...contact, type });
      },
      (group) => {
        console.log('[APP] group_invite received:', group.name, group.groupId);
        dispatch({ type: 'ADD_GROUP', payload: group });
        setGroupNotif(group);
      }
    );

    meshRouter.getMyGroups = () => groupsRef.current.map(g => g.groupId);

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

    return () => { transport.stop(); transportRef.current = null; };
  }, [state.identity, state.crypto]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (initError) {
    return (
      <View style={s.center}>
        <Text style={s.errorTitle}>Startup error</Text>
        <Text style={s.errorMsg}>{initError}</Text>
      </View>
    );
  }

  if (!state.crypto) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={s.loadingText}>Initialising...</Text>
      </View>
    );
  }

  const deleteAccount = async () => {
    console.log('[APP] deleting account...');
    transportRef.current?.stop();
    await AsyncStorage.multiRemove([IDENTITY_KEY, CONTACTS_KEY, GROUPS_KEY, 'keypair_v1']);
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
      <ContactNotifModal
        notif={groupNotif ? { ...groupNotif, type: 'group_invite' } : null}
        onDismiss={() => setGroupNotif(null)}
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
  center: {
    flex: 1, backgroundColor: '#0a0a1a',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  loadingText: { color: '#555', fontSize: 14 },
  errorTitle:  { color: '#ff5252', fontSize: 18, fontWeight: 'bold' },
  errorMsg:    { color: '#ff5252', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
});
