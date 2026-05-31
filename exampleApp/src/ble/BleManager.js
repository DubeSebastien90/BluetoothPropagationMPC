import { BleManager as PlxManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { SERVICE_UUID, CHAR_UUID } from './constants';
import { BleAdvertiser } from './BleAdvertiser';
import { deserializePacket, serializePacket } from '../contracts/Packet';

// Hermes has btoa/atob but not escape/unescape — use encodeURIComponent instead
function toBase64(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/gi, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  ));
}
function fromBase64(b64) {
  return decodeURIComponent(
    atob(b64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  );
}

export class BleManager {
  constructor({ onPacketReceived, onPeerConnected, onPeerDisconnected }) {
    this.plx              = new PlxManager();
    this.connectedDevices = new Map(); // deviceId → device
    this._connecting      = new Set(); // deviceIds with in-flight connect
    this.onPacketReceived  = onPacketReceived;
    this.onPeerConnected   = onPeerConnected;
    this.onPeerDisconnected = onPeerDisconnected;

    this.advertiser = new BleAdvertiser({
      onPacketReceived: (packet) => this.onPacketReceived(packet, null),
    });
  }

  async start() {
    await this._requestPermissions();
    await this._waitForPowerOn();
    await this.advertiser.start();
    this._scan();
  }

  async stop() {
    this.plx.stopDeviceScan();
    this.plx.destroy();
    await this.advertiser.stop();
  }

  async sendPacket(packet, excludeDeviceId = null) {
    const encoded = toBase64(serializePacket(packet));
    const targets = [...this.connectedDevices.entries()]
      .filter(([id]) => id !== excludeDeviceId);

    if (targets.length === 0) {
      console.warn('[BLE] sendPacket: no connected peers, message dropped');
      return;
    }

    for (const [id, device] of targets) {
      try {
        await device.writeCharacteristicWithResponseForService(
          SERVICE_UUID, CHAR_UUID, encoded
        );
      } catch (e) {
        console.warn('[BLE] send failed to', id, e.message);
      }
    }
  }

  getPeerIds() {
    return [...this.connectedDevices.keys()];
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  async _requestPermissions() {
    if (Platform.OS !== 'android') return;
    if (Platform.Version >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      const denied = Object.values(results).some(
        r => r !== PermissionsAndroid.RESULTS.GRANTED
      );
      if (denied) throw new Error('Bluetooth permissions denied');
    } else {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED)
        throw new Error('Location permission denied');
    }
  }

  async _waitForPowerOn() {
    return new Promise(resolve => {
      const sub = this.plx.onStateChange(state => {
        if (state === 'PoweredOn') { sub.remove(); resolve(); }
      }, true);
    });
  }

  _scan() {
    this.plx.startDeviceScan(
      [SERVICE_UUID],
      {
        allowDuplicates: false,
        ...(Platform.OS === 'android' && { scanMode: 2 }), // LOW_LATENCY
      },
      async (error, device) => {
        if (error || !device) return;
        if (this.connectedDevices.has(device.id) || this._connecting.has(device.id)) return;
        try { await this._connect(device); }
        catch (e) { console.warn('[BLE] connect failed:', e.message); }
      }
    );
  }

  async _connect(device) {
    this._connecting.add(device.id);
    try {
      const connected = await device.connect({ timeout: 10000 });

      // Negotiate larger MTU on Android — default 20 bytes is too small for packets
      if (Platform.OS === 'android') await connected.requestMTU(512);

      await connected.discoverAllServicesAndCharacteristics();

      this.connectedDevices.set(device.id, connected);
      this.onPeerConnected(device.id, device.name ?? 'Unknown');

      connected.onDisconnected(() => {
        this.connectedDevices.delete(device.id);
        this.onPeerDisconnected(device.id);
        setTimeout(() => this._scan(), 2000); // re-scan after disconnect
      });
    } finally {
      this._connecting.delete(device.id);
    }
  }
}
