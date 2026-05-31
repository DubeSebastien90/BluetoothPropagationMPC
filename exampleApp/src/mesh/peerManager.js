const TAG = '[PEERS]';

export class PeerManager {
  constructor(onPeersChanged) {
    this.peers = new Map();
    this.onPeersChanged = onPeersChanged;
  }

  onPeerConnected(deviceId, name) {
    this.peers.set(deviceId, { deviceId, name, connectedAt: Date.now() });
    console.log(TAG, `connected: ${name} (…${deviceId.slice(-5)}) — total peers: ${this.peers.size}`);
    this.onPeersChanged([...this.peers.values()]);
  }

  onPeerDisconnected(deviceId) {
    const peer = this.peers.get(deviceId);
    this.peers.delete(deviceId);
    console.log(TAG, `disconnected: ${peer?.name ?? deviceId.slice(-5)} — total peers: ${this.peers.size}`);
    this.onPeersChanged([...this.peers.values()]);
  }

  getPeers() { return [...this.peers.values()]; }
  getCount() { return this.peers.size; }
}
