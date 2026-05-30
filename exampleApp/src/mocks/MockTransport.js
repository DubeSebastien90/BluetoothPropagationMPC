import { createPacket } from '../contracts/Packet';

const FAKE_PUBKEY_1 = 'fakepubkey_alice_sim_base64==';
const FAKE_PUBKEY_2 = 'fakepubkey_bob_sim_base64==';

export class MockTransport {
  constructor({ onPacketReceived, onPeerConnected, onPeerDisconnected }) {
    this.onPacketReceived = onPacketReceived;
    this.onPeerConnected = onPeerConnected;
    this.onPeerDisconnected = onPeerDisconnected;
    this.peers = ['device-sim-1', 'device-sim-2'];
    this.sent = []; // log of sent packets for testing
  }

  async start() {
    // Simulate two peers connecting after 1 second
    setTimeout(() => {
      this.onPeerConnected('device-sim-1', 'Alice-Sim');
      this.onPeerConnected('device-sim-2', 'Bob-Sim');
    }, 1000);
  }

  async stop() {}

  sendPacket(packet, excludeId = null) {
    this.sent.push({ packet, excludeId });
    console.log('[MockTransport] sendPacket:', packet);
  }

  getPeerIds() { return this.peers; }

  // Test helper — fake a packet arriving from outside
  // Uses fake pubkeys so router can test identity-based routing
  simulateIncoming(fromNickname, toNickname, body, fromPubkey = FAKE_PUBKEY_1, toPubkey = FAKE_PUBKEY_2) {
    const packet = createPacket({
      from:   fromNickname,
      fromId: fromPubkey,
      to:     toNickname,
      toId:   toPubkey,
      body,
    });
    this.onPacketReceived(packet, 'device-sim-1');
  }
}
