import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import { deserializePacket } from '../contracts/Packet';

// iOS: Expo Module accessed via requireNativeModule
// Android: classic NativeModules
let NativePeripheral;
let emitter;

if (Platform.OS === 'ios') {
  const { requireNativeModule, EventEmitter } = require('expo-modules-core');
  NativePeripheral = requireNativeModule('BlePeripheral');
  emitter = new EventEmitter(NativePeripheral);
} else {
  NativePeripheral = NativeModules.BlePeripheral;
  emitter = new NativeEventEmitter(NativePeripheral);
}

export class BleAdvertiser {
  constructor({ onPacketReceived }) {
    this.onPacketReceived = onPacketReceived;
    this._subscription = null;
  }

  async start() {
    // Listen for incoming writes from centrals before advertising
    // so we don't miss a packet that arrives immediately on connect
    this._subscription = emitter.addListener('onPacketReceived', (event) => {
      // iOS sends { data: string }, Android sends the string directly
      const raw = typeof event === 'string' ? event : event?.data;
      if (!raw) return;
      const packet = deserializePacket(raw);
      if (packet) this.onPacketReceived(packet);
    });

    await NativePeripheral.startPeripheral();
  }

  async stop() {
    this._subscription?.remove();
    this._subscription = null;
    await NativePeripheral.stopPeripheral();
  }
}
