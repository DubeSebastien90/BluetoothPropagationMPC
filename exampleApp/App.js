import React, { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, useApp } from './src/state/AppContext';
import { AppNavigator }        from './src/navigation/AppNavigator';
import { SetupScreen }         from './src/screens/SetupScreen';
import { BleManager }          from './src/ble/BleManager';
import { MeshRouter }          from './src/mesh/MeshRouter';
import { PeerManager }         from './src/mesh/peerManager';
import { RealCrypto }          from './src/crypto/RealCrypto';

function AppInner() {
  const { state, dispatch } = useApp();

  // Restore persisted identity on launch.
  // Reconciles the stored pubkey with the real keypair — one-time fix for devices
  // that were set up before RealCrypto (when NullCrypto wrote 'null-crypto-pubkey').
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('identity');
      if (!stored) return;

      const savedIdentity = JSON.parse(stored);
      const crypto = new RealCrypto();
      const { pubkey } = await crypto.initialize();

      if (savedIdentity.pubkey !== pubkey) {
        const updated = { ...savedIdentity, pubkey };
        await AsyncStorage.setItem('identity', JSON.stringify(updated));
        dispatch({ type: 'SET_IDENTITY', payload: updated });
      } else {
        dispatch({ type: 'SET_IDENTITY', payload: savedIdentity });
      }
    })();
  }, []);

  // Start BLE once identity is set
  useEffect(() => {
    if (!state.identity) return;

    let transport = null;
    let mounted = true;

    (async () => {
      const crypto = new RealCrypto();
      await crypto.initialize();  // loads keypair from AsyncStorage
      if (!mounted) return;

      const peerManager = new PeerManager((peers) =>
        dispatch({ type: 'SET_PEERS', payload: peers })
      );

      const meshRouter = new MeshRouter(
        state.identity,
        null,
        crypto,
        (message) => dispatch({ type: 'ADD_MESSAGE', payload: message })
      );

      transport = new BleManager({
        onPacketReceived:   (packet, fromId) => meshRouter._handleIncoming(packet, fromId),
        onPeerConnected:    (id, name) => peerManager.onPeerConnected(id, name),
        onPeerDisconnected: (id) => peerManager.onPeerDisconnected(id),
      });

      meshRouter.transport = transport;
      meshRouter.start();
      dispatch({ type: 'SET_ROUTER', payload: meshRouter });

      transport.start().catch(e => console.error('[BLE] start failed:', e));
    })();

    return () => {
      mounted = false;
      transport?.stop();
    };
  }, [state.identity]);

  if (!state.identity) return <SetupScreen crypto={new RealCrypto()} />;
  return <AppNavigator />;
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
