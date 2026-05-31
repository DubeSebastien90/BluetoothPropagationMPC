import AsyncStorage from '@react-native-async-storage/async-storage';
import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';

const { encodeBase64, decodeBase64 } = naclUtil;

const STORAGE_KEY = 'keypair_v1';
const TAG = '[CRYPTO]';

export class RealCrypto {
  constructor() {
    this.publicKey = null;
    this.secretKey = null;
    this.peerKeys  = new Map(); // pubkeyB64 → Uint8Array
    this.peerNames = new Map(); // pubkeyB64 → nickname
  }

  async initialize() {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const { pub, sec } = JSON.parse(stored);
      this.publicKey = new Uint8Array(decodeBase64(pub));
      this.secretKey = new Uint8Array(decodeBase64(sec));
      console.log(TAG, 'keypair loaded from storage, pubkey:', pub.slice(0, 12) + '...');
    } else {
      const pair = nacl.box.keyPair();
      this.publicKey = pair.publicKey;
      this.secretKey = pair.secretKey;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        pub: encodeBase64(this.publicKey),
        sec: encodeBase64(this.secretKey),
      }));
      console.log(TAG, 'new keypair generated, pubkey:', this.getPublicKey().slice(0, 12) + '...');
    }
    return { nickname: null, pubkey: this.getPublicKey() };
  }

  getPublicKey() {
    return encodeBase64(this.publicKey);
  }

  registerPeerKey(pubkey, nickname) {
    const isNew = !this.peerKeys.has(pubkey);
    this.peerKeys.set(pubkey, new Uint8Array(decodeBase64(pubkey)));
    this.peerNames.set(pubkey, nickname);
    if (isNew) console.log(TAG, 'registered peer key for', nickname, pubkey.slice(0, 12) + '...');
  }

  getPeerKey(pubkey) {
    return this.peerKeys.has(pubkey) ? pubkey : null;
  }

  getNickname(pubkey) {
    return this.peerNames.get(pubkey) ?? null;
  }

  encrypt(body, recipientPubKeyB64) {
    const recipientKey = new Uint8Array(decodeBase64(recipientPubKeyB64));
    const nonce        = nacl.randomBytes(nacl.box.nonceLength);
    const encrypted    = nacl.box(new Uint8Array(new TextEncoder().encode(body)), nonce, recipientKey, this.secretKey);
    const result       = encodeBase64(new Uint8Array(nonce)) + '.' + encodeBase64(new Uint8Array(encrypted));
    console.log(TAG, 'encrypted message for', recipientPubKeyB64.slice(0, 12) + '...');
    return result;
  }

  decrypt(payload, senderPubKeyB64) {
    const dot       = payload.indexOf('.');
    const nonce     = new Uint8Array(decodeBase64(payload.slice(0, dot)));
    const box       = new Uint8Array(decodeBase64(payload.slice(dot + 1)));
    const senderKey = new Uint8Array(decodeBase64(senderPubKeyB64));
    const decrypted = nacl.box.open(box, nonce, senderKey, this.secretKey);
    if (!decrypted) {
      console.warn(TAG, 'decryption failed — wrong key or tampered message');
      throw new Error('Decryption failed — wrong key or tampered message');
    }
    console.log(TAG, 'decrypted message from', senderPubKeyB64.slice(0, 12) + '...');
    return new TextDecoder().decode(new Uint8Array(decrypted));
  }
}
