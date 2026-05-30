/**
 * CRYPTO CONTRACT
 * Any crypto implementation must match this interface exactly.
 * When encryption is disabled use NullCrypto (passthrough).
 * Swap NullCrypto for RealCrypto in App.js — nothing else changes.
 *
 * Methods:
 *   initialize() → Promise<{ nickname, pubkey }>
 *     Generates or loads keypair. Returns the local user's identity.
 *
 *   getPublicKey() → string | null
 *     Returns local user's public key (base64). This IS their user ID.
 *
 *   encrypt(body: string, recipientPubKey: string) → string
 *   decrypt(body: string, senderPubKey: string) → string
 *
 *   registerPeerKey(pubkey: string, nickname: string) → void
 *     Keys are indexed by pubkey (identity), nickname is just a label.
 *
 *   getPeerKey(pubkey: string) → string | null
 *     Look up a peer's key by their pubkey ID.
 *
 *   getNickname(pubkey: string) → string | null
 *     Look up a peer's display nickname by their pubkey ID.
 */
