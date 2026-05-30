/**
 * ROUTER CONTRACT
 * MeshRouter must implement this interface exactly.
 *
 * Constructor:
 *   new MeshRouter(identity, transport, crypto, onMessageForMe)
 *   identity = { nickname, pubkey } — the local user's identity object
 *
 * onMessageForMe receives:
 *   { id, from, fromId, to, toId, body, ts } — clean decoded message, never a raw packet
 *
 * Methods:
 *   send(toNickname: string, toId: string, body: string) → void   Send a message
 *   start() → void                                                 Wire up transport callbacks
 *   stop() → void                                                  Unwire everything
 *
 * Routing is always by toId (pubkey), never by nickname alone.
 */
