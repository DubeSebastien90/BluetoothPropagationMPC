import { createPacket } from '../contracts/Packet';

const TAG = '[ROUTER]';

export class MeshRouter {
  constructor(identity, transport, crypto, onMessageForMe, onContactRequest, onGroupInvite) {
    this.identity         = identity;
    this.transport        = transport;
    this.crypto           = crypto;
    this.onMessageForMe   = onMessageForMe;
    this.onContactRequest = onContactRequest ?? (() => {});
    this.onGroupInvite    = onGroupInvite    ?? (() => {});
    this.seen             = new Map();
    this.SEEN_TTL_MS      = 60_000;
  }

  start() {
    console.log(TAG, 'started — identity:', this.identity.nickname, this.identity.pubkey.slice(0, 12) + '...');
    this.transport.onPacketReceived = this._handleIncoming.bind(this);
  }

  stop() {
    console.log(TAG, 'stopped');
    this.transport.onPacketReceived = null;
  }

  sendGroupInvite(group, contact) {
    const rawBody = JSON.stringify(group);
    const body = this._tryEncrypt(rawBody, contact.pubkey); // consistent with DMs
    const packet = createPacket({
      from:   this.identity.nickname,
      fromId: this.identity.pubkey,
      to:     contact.nickname,
      toId:   contact.pubkey,
      body,
      type:   'group_invite',
    });
    console.log(TAG, 'sending group_invite to', contact.nickname, 'for group', group.name);
    this.seen.set(packet.id, Date.now());
    this.transport.sendPacket(packet);
  }

  sendGroupMessage(group, body) {
    const packet = createPacket({
      from:    this.identity.nickname,
      fromId:  this.identity.pubkey,
      to:      group.name,
      toId:    'all',       // rides broadcast path — no stale closure needed
      groupId: group.groupId, // UI tag so only members show it in their group screen
      body,
      type:    'msg',
    });
    console.log(TAG, 'sending group message to', group.name, '(', group.groupId, ')');
    this.seen.set(packet.id, Date.now());
    this.transport.sendPacket(packet);
  }

  sendContactRequest(contact) {
    const body = JSON.stringify({ nickname: this.identity.nickname, pubkey: this.identity.pubkey });
    const packet = createPacket({
      from:   this.identity.nickname,
      fromId: this.identity.pubkey,
      to:     contact.nickname,
      toId:   contact.pubkey,
      body,
      type:   'contact_req',
    });
    console.log(TAG, 'sending contact_req to', contact.nickname, contact.pubkey.slice(0, 12) + '...');
    this.seen.set(packet.id, Date.now());
    this.transport.sendPacket(packet);
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
      'from:', packet.from, 'to:', packet.to, 'type:', packet.type ?? 'msg', 'ttl:', packet.ttl);

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

    const isForMe = packet.toId === this.identity.pubkey;

    // Handle group_invite — consume, do not relay
    // type tells us the body is JSON (possibly encrypted like a DM — _tryDecrypt handles both)
    if (packet.type === 'group_invite' && isForMe) {
      console.log(TAG, 'group_invite from', packet.from);
      try {
        // _tryDecrypt returns raw body if no key — safe for both plaintext and encrypted
        const body = this._tryDecrypt(packet.body, packet.fromId);
        const group = JSON.parse(body);
        if (group.groupId && group.name && group.members) {
          this.onGroupInvite(group);
        }
      } catch (e) {
        console.warn(TAG, 'group_invite parse failed:', e.message);
      }
      return;
    }

    // Handle contact_req — consume, reply, do not relay
    if (packet.type === 'contact_req' && isForMe) {
      console.log(TAG, 'contact_req from', packet.from, '— auto-adding and sending ack');
      try {
        const contact = JSON.parse(packet.body);
        if (contact.nickname && contact.pubkey) {
          this.onContactRequest(contact, 'contact_req');
          // Send ack back so the scanner knows it worked
          const ack = createPacket({
            from:   this.identity.nickname,
            fromId: this.identity.pubkey,
            to:     packet.from,
            toId:   packet.fromId,
            body:   JSON.stringify({ nickname: this.identity.nickname, pubkey: this.identity.pubkey }),
            type:   'contact_ack',
          });
          this.seen.set(ack.id, Date.now());
          this.transport.sendPacket(ack);
        }
      } catch (e) {
        console.warn(TAG, 'contact_req parse failed:', e.message);
      }
      return;
    }

    // Handle contact_ack — consume, do not relay
    if (packet.type === 'contact_ack' && isForMe) {
      console.log(TAG, 'contact_ack from', packet.from, '— they added us back');
      try {
        const contact = JSON.parse(packet.body);
        if (contact.nickname && contact.pubkey) {
          this.onContactRequest(contact, 'contact_ack');
        }
      } catch (e) {
        console.warn(TAG, 'contact_ack parse failed:', e.message);
      }
      return;
    }

    const isBroadcast = packet.toId === 'all';

    if (isForMe || isBroadcast) {
      console.log(TAG, isBroadcast ? 'broadcast for me' : 'direct message for me',
        '— from:', packet.from);

      const decryptedBody = isBroadcast
        ? packet.body
        : this._tryDecrypt(packet.body, packet.fromId);

      this.onMessageForMe({
        id:      packet.id,
        from:    packet.from,
        fromId:  packet.fromId,
        to:      packet.to,
        toId:    packet.toId,
        body:    decryptedBody,
        ts:      packet.ts,
        ...(packet.groupId && { groupId: packet.groupId }),
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
