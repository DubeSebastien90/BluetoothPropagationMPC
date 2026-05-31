/**
 * @typedef {Object} Packet
 * @property {string} id        - 4-char unique ID. Used for deduplication.
 * @property {string} from      - Sender nickname (display only)
 * @property {string} fromId    - Sender public key (actual identity, used for routing + encryption)
 * @property {string} to        - Recipient nickname or "all" for broadcast (display only)
 * @property {string} toId      - Recipient public key or "all" (actual routing target)
 * @property {number} ttl       - Hops remaining. Start at 5. Drop at 0.
 * @property {string} body      - Message text (plaintext now, ciphertext later)
 * @property {'msg'|'contact_req'|'contact_ack'} type - Packet purpose. Defaults to 'msg'.
 * @property {number} ts        - Unix timestamp ms
 *
 * Identity design:
 *   nickname (from/to)   = human-readable display label only
 *   fromId/toId          = actual identity — collision-proof, routes encryption
 *   Two users named "Alex" are different because their fromId differs.
 */

export const TTL_START = 5;

export function createPacket({ from, fromId, to, toId, body, type = 'msg' }) {
  return {
    id:     Math.random().toString(36).slice(2, 6),
    from,
    fromId,
    to,
    toId,
    ttl:    TTL_START,
    body,
    type,
    ts:     Date.now(),
  };
}

export function serializePacket(packet) {
  return JSON.stringify(packet);
}

export function deserializePacket(raw) {
  try {
    const p = JSON.parse(raw);
    if (!p.id || !p.from || !p.fromId || !p.to || !p.toId || p.ttl === undefined) return null;
    return p;
  } catch {
    return null;
  }
}
