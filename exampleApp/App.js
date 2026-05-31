import React, { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, useApp } from './src/state/AppContext';
import { AppNavigator }        from './src/navigation/AppNavigator';
import { SetupScreen, IDENTITY_KEY } from './src/screens/SetupScreen';
import { BleManager }          from './src/ble/BleManager';
import { MeshRouter }          from './src/mesh/MeshRouter';
import { PeerManager }         from './src/mesh/peerManager';
import { RealCrypto }          from './src/crypto/RealCrypto';

// Storage keys — versioned to prevent old NullCrypto data from conflicting
const CONTACTS_KEY = 'contacts_v1';

function AppInner() {
  const { state, dispatch } = useApp();

  // ── Step 1: Initialise crypto on launch ─────────────────────────────────────
  // Runs once. Generates or loads the keypair, then validates any stored identity.
  // If the stored identity has a different pubkey (e.g. from old NullCrypto run),
  // it is discarded so the user sets up fresh with their real keypair.
  useEffect(() => {
    const init = async () => {
      const crypto = new RealCrypto();
      const { pubkey } = await crypto.initialize();
      dispatch({ type: 'SET_CRYPTO', payload: crypto });

      const storedIdentity = await AsyncStorage.getItem(IDENTITY_KEY);
      if (storedIdentity) {
        const identity = JSON.parse(storedIdentity);

        if (identity.pubkey !== pubkey) {
          // Pubkey mismatch — old data from NullCrypto or a previous keypair.
          // Clear everything and let the user go through SetupScreen again.
          console.log('[APP] stored identity pubkey mismatch — clearing old data');
          await AsyncStorage.multiRemove([IDENTITY_KEY, CONTACTS_KEY]);
          return;
        }

        dispatch({ type: 'SET_IDENTITY', payload: identity });

        // Restore contacts and re-register their keys with crypto
        const storedContacts = await AsyncStorage.getItem(CONTACTS_KEY);
        if (storedContacts) {
          const contacts = JSON.parse(storedContacts);
          contacts.forEach(c => crypto.registerPeerKey(c.pubkey, c.nickname));
          dispatch({ type: 'SET_CONTACTS', payload: contacts });
        }
      }
    };

    init().catch(e => console.error('[APP] init failed:', e));
  }, []);

  // ── Step 2: Persist contacts whenever they change ────────────────────────────
  useEffect(() => {
    if (state.contacts.length > 0) {
      AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(state.contacts))
        .catch(e => console.warn('[APP] contacts save failed:', e));
    }
  }, [state.contacts]);

  // ── Step 3: Start BLE once both identity and crypto are ready ────────────────
  useEffect(() => {
    if (!state.identity || !state.crypto) return;

    const peerManager = new PeerManager((peers) =>
      dispatch({ type: 'SET_PEERS', payload: peers })
    );

    const meshRouter = new MeshRouter(
      state.identity,
      null,
      state.crypto,
      (message) => dispatch({ type: 'ADD_MESSAGE', payload: message })
    );

    const transport = new BleManager({
      onPacketReceived:   (packet, fromId) => meshRouter._handleIncoming(packet, fromId),
      onPeerConnected:    (id, name)       => peerManager.onPeerConnected(id, name),
      onPeerDisconnected: (id)             => peerManager.onPeerDisconnected(id),
    });

    meshRouter.transport = transport;
    meshRouter.start();
    dispatch({ type: 'SET_ROUTER', payload: meshRouter });

    transport.start().catch(e => console.error('[BLE] start failed:', e));

    return () => transport.stop();
  }, [state.identity, state.crypto]);

  // Wait for crypto to initialise before showing anything
  if (!state.crypto)   return null;
  if (!state.identity) return <SetupScreen />;
  return <AppNavigator />;
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
