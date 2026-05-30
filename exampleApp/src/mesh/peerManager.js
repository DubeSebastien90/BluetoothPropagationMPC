export class PeerManager {
  constructor(onPeersChanged) {
    this.peers = new Map(); // deviceId → { deviceId, name, connectedAt }
    this.onPeersChanged = onPeersChanged;
  }

  onPeerConnected(deviceId, name) {
    this.peers.set(deviceId, { deviceId, name, connectedAt: Date.now() });
    this.onPeersChanged([...this.peers.values()]);
  }

  onPeerDisconnected(deviceId) {
    this.peers.delete(deviceId);
    this.onPeersChanged([...this.peers.values()]);
  }

  getPeers() { return [...this.peers.values()]; }
  getCount() { return this.peers.size; }
}
