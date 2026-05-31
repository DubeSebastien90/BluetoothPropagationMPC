import { createPacket } from '../contracts/Packet';

const TAG = '[ROUTER]';

export class MeshRouter {
  constructor(identity, transport, crypto, onMessageForMe) {
    this.identity       = identity;
    this.transport      = transport;
    this.crypto         = crypto;
    this.onMessageForMe = onMessageForMe;
    this.seen           = new Map();
    this.SEEN_TTL_MS    = 60_000;
  }

  start() {
    console.log(TAG, 'started — identity:', this.identity.nickname, this.identity.pubkey.slice(0, 12) + '...');
    this.transport.onPacketReceived = this._handleIncoming.bind(this);
  }

  stop() {
    console.log(TAG, 'stopped');
    this.transport.onPacketReceived = null;
  }

  send(toNickname, toId, body) {
    const isBroadcast = toId === 'all';
    let encryptedBody = body;

    if (!isBroadcast) {
      encryptedBody = this._tryEncrypt(body, toId);
      const encrypted = encryptedBody !== body;
      console.log(TAG, `send → ${toNickname} (${toId.slice(0, 12)}...) encrypted:${encrypted}`);
    } else {
      console.log(TAG, 'send broadcast → all');
    }

    const packet = createPacket({
      from:   this.identity.nickname,
      fromId: this.identity.pubkey,
      to:     toNickname,
      toId,
      body:   encryptedBody,
    });

    console.log(TAG, 'created packet id:', packet.id, 'ttl:', packet.ttl);
    this.seen.set(packet.id, Date.now());
    this.transport.sendPacket(packet);
  }

  _handleIncoming(packet, fromDeviceId) {
    console.log(TAG, 'incoming packet id:', packet.id,
      'from:', packet.from, 'to:', packet.to, 'ttl:', packet.ttl);

    // Register sender's identity on every packet
    if (packet.fromId && packet.from) {
      this.crypto.registerPeerKey(packet.fromId, packet.from);
    }

    // Deduplicate
    if (this.seen.has(packet.id)) {
      console.log(TAG, 'duplicate packet', packet.id, '— dropped');
      return;
    }
    this.seen.set(packet.id, Date.now());
    this._pruneSeenCache();

    const isForMe     = packet.toId === this.identity.pubkey;
    const isBroadcast = packet.toId === 'all';

    if (isForMe || isBroadcast) {
      console.log(TAG, isBroadcast ? 'broadcast for me' : 'direct message for me',
        '— from:', packet.from);

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
    } else {
      console.log(TAG, 'packet not for me (to:', packet.to, ') — checking TTL...');
    }

    if (packet.ttl > 1) {
      console.log(TAG, 'relaying packet', packet.id, 'ttl:', packet.ttl, '→', packet.ttl - 1);
      this.transport.sendPacket({ ...packet, ttl: packet.ttl - 1 }, fromDeviceId);
    } else {
      console.log(TAG, 'TTL=1 — packet', packet.id, 'dropped, not relayed');
    }
  }

  _tryEncrypt(body, recipientPubKey) {
    const key = this.crypto.getPeerKey(recipientPubKey);
    if (!key) {
      console.warn(TAG, 'no key for', recipientPubKey.slice(0, 12) + '... — sending plaintext');
      return body;
    }
    try {
      return this.crypto.encrypt(body, key);
    } catch (e) {
      console.warn(TAG, 'encryption failed:', e.message, '— sending plaintext');
      return body;
    }
  }

  _tryDecrypt(body, senderPubKey) {
    const key = this.crypto.getPeerKey(senderPubKey);
    if (!key) {
      console.warn(TAG, 'no key for sender', senderPubKey.slice(0, 12) + '... — returning as-is');
      return body;
    }
    try {
      return this.crypto.decrypt(body, key);
    } catch (e) {
      console.warn(TAG, 'decryption failed:', e.message, '— returning raw body');
      return body;
    }
  }

  _pruneSeenCache() {
    const now = Date.now();
    let pruned = 0;
    for (const [id, ts] of this.seen) {
      if (now - ts > this.SEEN_TTL_MS) { this.seen.delete(id); pruned++; }
    }
    if (pruned > 0) console.log(TAG, 'pruned', pruned, 'old packet IDs from seen cache');
  }
}
