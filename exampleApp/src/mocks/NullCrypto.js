export class NullCrypto {
  async initialize() {
    // Return a fake identity so the app can run without real crypto
    return { nickname: null, pubkey: 'null-crypto-pubkey' };
  }
  getPublicKey() { return 'null-crypto-pubkey'; }
  encrypt(body, recipientPubKey) { return body; }    // passthrough
  decrypt(body, senderPubKey) { return body; }        // passthrough
  registerPeerKey(pubkey, nickname) {}
  getPeerKey(pubkey) { return null; }
  getNickname(pubkey) { return null; }
}
