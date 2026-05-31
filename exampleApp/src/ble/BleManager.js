import { BleManager as PlxManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { SERVICE_UUID, CHAR_UUID } from './constants';
import { BleAdvertiser } from './BleAdvertiser';
import { deserializePacket, serializePacket } from '../contracts/Packet';

const TAG = '[BLE-C]'; // C = central

function toBase64(str)   { return btoa(unescape(encodeURIComponent(str))); }

export class BleManager {
  constructor({ onPacketReceived, onPeerConnected, onPeerDisconnected }) {
    this.plx               = new PlxManager();
    this.connectedDevices  = new Map();
    this.onPacketReceived  = onPacketReceived;
    this.onPeerConnected   = onPeerConnected;
    this.onPeerDisconnected = onPeerDisconnected;

    this.advertiser = new BleAdvertiser({
      onPacketReceived: (packet) => this.onPacketReceived(packet, null),
    });
  }

  async start() {
    console.log(TAG, 'starting — platform:', Platform.OS);
    await this._requestPermissions();
    await this._waitForPowerOn();
    await this.advertiser.start();
    this._scan();
  }

  async stop() {
    console.log(TAG, 'stopping');
    this.plx.stopDeviceScan();
    this.plx.destroy();
    await this.advertiser.stop();
  }

  async sendPacket(packet, excludeDeviceId = null) {
    const targets = [...this.connectedDevices.entries()]
      .filter(([id]) => id !== excludeDeviceId);

    console.log(TAG, 'sending packet id:', packet.id, 'to:', packet.to,
      '— targets:', targets.length, excludeDeviceId ? `(excluding ${excludeDeviceId.slice(-5)})` : '');

    if (targets.length === 0) {
      console.warn(TAG, 'no connected peers to send to');
      return;
    }

    const encoded = toBase64(serializePacket(packet));
    for (const [id, device] of targets) {
      try {
        await device.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_UUID, encoded);
        console.log(TAG, 'sent to', id.slice(-5));
      } catch (e) {
        console.warn(TAG, 'send failed to', id.slice(-5), '—', e.message);
      }
    }
  }

  getPeerIds() {
    return [...this.connectedDevices.keys()];
  }

  async _requestPermissions() {
    if (Platform.OS !== 'android') return;
    console.log(TAG, 'requesting Android permissions (API', Platform.Version + ')');
    if (Platform.Version >= 31) {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
    } else {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    }
    console.log(TAG, 'permissions requested');
  }

  async _waitForPowerOn() {
    console.log(TAG, 'waiting for Bluetooth to power on...');
    return new Promise(resolve => {
      const sub = this.plx.onStateChange(state => {
        console.log(TAG, 'BT state:', state);
        if (state === 'PoweredOn') { sub.remove(); resolve(); }
      }, true);
    });
  }

  _scan() {
    console.log(TAG, 'scan started — looking for SERVICE_UUID');
    this.plx.startDeviceScan(
      [SERVICE_UUID],
      {
        allowDuplicates: false,
        ...(Platform.OS === 'android' && { scanMode: 2 }),
      },
      async (error, device) => {
        if (error) {
          console.warn(TAG, 'scan error:', error.message);
          return;
        }
        if (!device) return;

        if (this.connectedDevices.has(device.id)) {
          console.log(TAG, 'device already connected:', device.id.slice(-5), '— skipping');
          return;
        }

        console.log(TAG, 'found device:', device.id.slice(-5), device.name ?? '(no name)', '— connecting...');
        try {
          await this._connect(device);
        } catch (e) {
          console.warn(TAG, 'connect failed for', device.id.slice(-5), '—', e.message);
        }
      }
    );
  }

  async _connect(device) {
    const connected = await device.connect({ timeout: 10000 });
    console.log(TAG, 'connected to', device.id.slice(-5));

    if (Platform.OS === 'android') {
      const mtu = await connected.requestMTU(512);
      console.log(TAG, 'MTU negotiated:', mtu, 'for', device.id.slice(-5));
    }

    await connected.discoverAllServicesAndCharacteristics();
    console.log(TAG, 'services discovered for', device.id.slice(-5));

    this.connectedDevices.set(device.id, connected);
    this.onPeerConnected(device.id, device.name ?? 'Unknown');

    connected.onDisconnected(() => {
      console.log(TAG, 'disconnected from', device.id.slice(-5), '— will rescan in 2s');
      this.connectedDevices.delete(device.id);
      this.onPeerDisconnected(device.id);
      setTimeout(() => {
        console.log(TAG, 'restarting scan after disconnect');
        this._scan();
      }, 2000);
    });
  }
}
