import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Versioned key — bump to 'keypair_v2' if the key format ever changes.
// This prevents old incompatible keypairs from being loaded silently.
const STORAGE_KEY = 'keypair_v1';

export class RealCrypto {
  constructor() {
    this.publicKey  = null; // Uint8Array
    this.secretKey  = null; // Uint8Array
    this.peerKeys   = new Map(); // pubkeyB64 → Uint8Array
    this.peerNames  = new Map(); // pubkeyB64 → nickname
  }

  // Generates or loads the keypair.
  // Returns { nickname: null, pubkey: string } — nickname is set by SetupScreen.
  async initialize() {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const { pub, sec } = JSON.parse(stored);
      this.publicKey = decodeBase64(pub);
      this.secretKey = decodeBase64(sec);
    } else {
      const pair = nacl.box.keyPair();
      this.publicKey = pair.publicKey;
      this.secretKey = pair.secretKey;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        pub: encodeBase64(this.publicKey),
        sec: encodeBase64(this.secretKey),
      }));
    }
    return { nickname: null, pubkey: this.getPublicKey() };
  }

  getPublicKey() {
    return encodeBase64(this.publicKey);
  }

  // Indexed by pubkey — collision-proof identity
  registerPeerKey(pubkey, nickname) {
    this.peerKeys.set(pubkey, decodeBase64(pubkey));
    this.peerNames.set(pubkey, nickname);
  }

  getPeerKey(pubkey) {
    return this.peerKeys.has(pubkey) ? pubkey : null;
  }

  getNickname(pubkey) {
    return this.peerNames.get(pubkey) ?? null;
  }

  encrypt(body, recipientPubKeyB64) {
    const recipientKey = decodeBase64(recipientPubKeyB64);
    const nonce        = nacl.randomBytes(nacl.box.nonceLength);
    const encrypted    = nacl.box(
      encodeUTF8(body),
      nonce,
      recipientKey,
      this.secretKey
    );
    // Compact wire format: nonce.ciphertext — no JSON overhead
    return encodeBase64(nonce) + '.' + encodeBase64(encrypted);
  }

  decrypt(payload, senderPubKeyB64) {
    const dot       = payload.indexOf('.');
    const nonce     = decodeBase64(payload.slice(0, dot));
    const box       = decodeBase64(payload.slice(dot + 1));
    const senderKey = decodeBase64(senderPubKeyB64);
    const decrypted = nacl.box.open(box, nonce, senderKey, this.secretKey);
    if (!decrypted) throw new Error('Decryption failed — wrong key or tampered message');
    return decodeUTF8(decrypted);
  }
}
