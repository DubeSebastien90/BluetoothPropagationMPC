import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Hermes exposes crypto on global, not on self. Override nacl's PRNG so it
// uses the correct reference instead of failing with "no PRNG".
nacl.setPRNG((output, n) => {
  const bytes = new Uint8Array(n);
  global.crypto.getRandomValues(bytes);
  for (let i = 0; i < n; i++) output[i] = bytes[i];
});

// Implements CryptoContract using X25519-XSalsa20-Poly1305 (same primitives as libsodium crypto_box_easy).
// Pure JS — works with Hermes (no WASM required).
export class RealCrypto {
  constructor() {
    this.publicKey = null;  // Uint8Array
    this.secretKey = null;  // Uint8Array
    this.peerKeys  = new Map(); // pubkey_b64 → Uint8Array
    this.peerNames = new Map(); // pubkey_b64 → nickname
  }

  async initialize() {
    const stored = await AsyncStorage.getItem('keypair_v1');
    if (stored) {
      const { pub, priv } = JSON.parse(stored);
      this.publicKey = decodeBase64(pub);
      this.secretKey = decodeBase64(priv);
    } else {
      const pair = nacl.box.keyPair();
      this.publicKey = pair.publicKey;
      this.secretKey = pair.secretKey;
      await AsyncStorage.setItem('keypair_v1', JSON.stringify({
        pub:  encodeBase64(this.publicKey),
        priv: encodeBase64(this.secretKey),
      }));
    }
    return { nickname: null, pubkey: encodeBase64(this.publicKey) };
  }

  getPublicKey() {
    return this.publicKey ? encodeBase64(this.publicKey) : null;
  }

  // Keys are indexed by pubkey (base64) — collision-proof identity
  registerPeerKey(pubkey, nickname) {
    this.peerKeys.set(pubkey, decodeBase64(pubkey));
    this.peerNames.set(pubkey, nickname);
  }

  // Returns the pubkey string itself (which IS their public key) or null if unknown
  getPeerKey(pubkey) {
    return this.peerKeys.has(pubkey) ? pubkey : null;
  }

  getNickname(pubkey) {
    return this.peerNames.get(pubkey) ?? null;
  }

  encrypt(body, recipientPubKeyB64) {
    const recipientKey = decodeBase64(recipientPubKeyB64);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const ciphertext = nacl.box(encodeUTF8(body), nonce, recipientKey, this.secretKey);
    return JSON.stringify({
      n: encodeBase64(nonce),
      d: encodeBase64(ciphertext),
    });
  }

  decrypt(body, senderPubKeyB64) {
    const { n, d } = JSON.parse(body);
    const senderKey = decodeBase64(senderPubKeyB64);
    const plaintext = nacl.box.open(decodeBase64(d), decodeBase64(n), senderKey, this.secretKey);
    if (!plaintext) throw new Error('Decryption failed — bad key or corrupted message');
    return decodeUTF8(plaintext);
  }
}
