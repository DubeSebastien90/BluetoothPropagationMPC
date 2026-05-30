import { createPacket } from '../contracts/Packet';

export class MeshRouter {
  /**
   * @param {Object} identity   - { nickname, pubkey } — local user's identity
   * @param transport           - satisfies TransportContract
   * @param crypto              - satisfies CryptoContract
   * @param onMessageForMe      - callback({ id, from, fromId, to, toId, body, ts })
   */
  constructor(identity, transport, crypto, onMessageForMe) {
    this.identity = identity;
    this.transport = transport;
    this.crypto = crypto;
    this.onMessageForMe = onMessageForMe;
    this.seen = new Map(); // id → timestamp
    this.SEEN_TTL_MS = 60_000;
  }

  start() {
    this.transport.onPacketReceived = this._handleIncoming.bind(this);
  }

  stop() {
    this.transport.onPacketReceived = null;
  }

  // Called by ChatScreen
  // toId = recipient's pubkey (their actual identity)
  send(toNickname, toId, body) {
    const encryptedBody = toId === 'all'
      ? body
      : this._tryEncrypt(body, toId);

    const packet = createPacket({
      from:   this.identity.nickname,
      fromId: this.identity.pubkey,
      to:     toNickname,
      toId,
      body:   encryptedBody,
    });

    this.seen.set(packet.id, Date.now());
    this.transport.sendPacket(packet);
  }

  _handleIncoming(packet, fromDeviceId) {
    // Register sender identity — fromId IS their public key
    if (packet.fromId && packet.from) {
      this.crypto.registerPeerKey(packet.fromId, packet.from);
    }

    // Deduplicate
    if (this.seen.has(packet.id)) return;
    this.seen.set(packet.id, Date.now());
    this._pruneSeenCache();

    // Match on pubkey (toId), not nickname — collision-proof
    const isForMe    = packet.toId === this.identity.pubkey;
    const isBroadcast = packet.toId === 'all';

    if (isForMe || isBroadcast) {
      const decryptedBody = isBroadcast
        ? packet.body
        : this._tryDecrypt(packet.body, packet.fromId);

      this.onMessageForMe({
        id:     packet.id,
        from:   packet.from,
        fromId: packet.fromId,
        to:     packet.to,
        toId:   packet.toId,
        body:   decryptedBody,
        ts:     packet.ts,
      });
    }

    // Relay if TTL allows — even if it was also for me
    if (packet.ttl > 1) {
      this.transport.sendPacket(
        { ...packet, ttl: packet.ttl - 1 },
        fromDeviceId
      );
    }
  }

  _tryEncrypt(body, recipientPubKey) {
    const key = this.crypto.getPeerKey(recipientPubKey);
    if (!key) return body;
    try { return this.crypto.encrypt(body, key); }
    catch { return body; }
  }

  _tryDecrypt(body, senderPubKey) {
    const key = this.crypto.getPeerKey(senderPubKey);
    if (!key) return body;
    try { return this.crypto.decrypt(body, key); }
    catch { return body; }
  }

  _pruneSeenCache() {
    const now = Date.now();
    for (const [id, ts] of this.seen) {
      if (now - ts > this.SEEN_TTL_MS) this.seen.delete(id);
    }
  }
}
