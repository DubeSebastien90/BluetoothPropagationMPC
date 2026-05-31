import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import { deserializePacket } from '../contracts/Packet';

const TAG = '[BLE-P]'; // P = peripheral

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
    this._subscription    = null;
  }

  async start() {
    console.log(TAG, 'starting peripheral — subscribing to write events');

    this._subscription = emitter.addListener('onPacketReceived', (event) => {
      const raw = typeof event === 'string' ? event : event?.data;
      console.log(TAG, 'raw write received, length:', raw?.length ?? 0);

      if (!raw) {
        console.warn(TAG, 'write event had no data — skipping');
        return;
      }

      const packet = deserializePacket(raw);
      if (packet) {
        console.log(TAG, 'packet parsed OK — id:', packet.id, 'from:', packet.from, 'to:', packet.to, 'ttl:', packet.ttl);
        this.onPacketReceived(packet);
      } else {
        console.warn(TAG, 'failed to deserialize packet — raw:', raw.slice(0, 80));
      }
    });

    await NativePeripheral.startPeripheral();
    console.log(TAG, 'advertising started');
  }

  async stop() {
    console.log(TAG, 'stopping peripheral');
    this._subscription?.remove();
    this._subscription = null;
    await NativePeripheral.stopPeripheral();
    console.log(TAG, 'advertising stopped');
  }
}
