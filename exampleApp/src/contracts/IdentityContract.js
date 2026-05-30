/**
 * @typedef {Object} Identity
 * @property {string} nickname  - Human-readable display name (not unique)
 * @property {string} pubkey    - Public key base64 (unique ID — collision-proof)
 * @property {number} version   - Schema version for future compatibility (always 1 for now)
 *
 * This is what gets encoded in the QR code.
 * This is what gets stored in AsyncStorage for the local user.
 * This is what gets registered when you scan someone else's QR.
 *
 * QR payload = JSON.stringify(identity)
 * Scan result = JSON.parse(qrData) → Identity
 */

export function encodeIdentityForQR(identity) {
  return JSON.stringify({
    nickname: identity.nickname,
    pubkey:   identity.pubkey,
    version:  1,
  });
}

export function decodeIdentityFromQR(qrData) {
  try {
    const parsed = JSON.parse(qrData);
    if (!parsed.nickname || !parsed.pubkey || !parsed.version) return null;
    return parsed;
  } catch {
    return null;
  }
}
