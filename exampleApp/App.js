import React, { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, useApp } from './src/state/AppContext';
import { AppNavigator }        from './src/navigation/AppNavigator';
import { SetupScreen }         from './src/screens/SetupScreen';
import { BleManager }          from './src/ble/BleManager';
import { MeshRouter }          from './src/mesh/MeshRouter';
import { PeerManager }         from './src/mesh/peerManager';
import { NullCrypto }          from './src/mocks/NullCrypto';
// Swap the line above for this when adding encryption:
// import { RealCrypto } from './src/crypto/RealCrypto';

function AppInner() {
  const { state, dispatch } = useApp();

  // Restore persisted identity on launch
  useEffect(() => {
    AsyncStorage.getItem('identity').then(stored => {
      if (stored) dispatch({ type: 'SET_IDENTITY', payload: JSON.parse(stored) });
    });
  }, []);

  // Start BLE once identity is set
  useEffect(() => {
    if (!state.identity) return;

    const crypto = new NullCrypto();

    const peerManager = new PeerManager((peers) =>
      dispatch({ type: 'SET_PEERS', payload: peers })
    );

    const meshRouter = new MeshRouter(
      state.identity,
      null,
      crypto,
      (message) => dispatch({ type: 'ADD_MESSAGE', payload: message })
    );

    const transport = new BleManager({
      onPacketReceived:   (packet, fromId) => meshRouter._handleIncoming(packet, fromId),
      onPeerConnected:    (id, name) => peerManager.onPeerConnected(id, name),
      onPeerDisconnected: (id) => peerManager.onPeerDisconnected(id),
    });

    meshRouter.transport = transport;
    meshRouter.start();
    dispatch({ type: 'SET_ROUTER', payload: meshRouter });

    transport.start().catch(e => console.error('[BLE] start failed:', e));

    return () => transport.stop();
  }, [state.identity]);

  if (!state.identity) return <SetupScreen crypto={new NullCrypto()} />;
  return <AppNavigator />;
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
