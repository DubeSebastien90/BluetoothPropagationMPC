# Mesh Chat — Parallel Build Plan
### Feature Contracts · Incremental Testing · Modular by Design

---

## Core Philosophy

Every module communicates through a **typed contract** defined upfront. Each dev builds their module independently and wires it in when ready. Encryption is a **drop-in middleware** — the rest of the system never changes when you add it.

```
The Golden Rule:
No module imports another module directly.
They only speak through contracts.
```

---

## The 5 Features (build in parallel)

```
Feature A — BLE Transport     → Dev A (Mac #1)
Feature B — Mesh Router       → Dev B (Mac #2)
Feature C — UI + State        → Dev C (Windows)
Feature D — Identity + QR     → Dev C (Windows), after SetupScreen
Feature E — Encryption        → anyone, after A+B+C+D work
```

Each feature has:
- A **contract** (the interface it exposes)
- A **mock** (a fake version so other devs don't block on it)
- **Incremental tests** (how to verify it works in isolation)

---

## Step 0 — Contracts (define these FIRST, before writing any logic)

These files go in `src/contracts/`. Nobody changes these without telling the whole team.

---

### Contract 1 — Packet

`src/contracts/Packet.js`

The shared data format. Every module speaks this language.

```js
/**
 * @typedef {Object} Packet
 * @property {string} id        - 4-char unique ID. Used for deduplication.
 * @property {string} from      - Sender nickname (display only)
 * @property {string} fromId    - Sender public key (actual identity, used for routing + encryption)
 * @property {string} to        - Recipient nickname or "all" for broadcast (display only)
 * @property {string} toId      - Recipient public key or "all" (actual routing target)
 * @property {number} ttl       - Hops remaining. Start at 5. Drop at 0.
 * @property {string} body      - Message text (plaintext now, ciphertext later)
 * @property {string} [pubkey]  - Sender public key (always included — lets recipients register you on first contact)
 * @property {number} ts        - Unix timestamp ms
 *
 * Identity design:
 *   nickname (from/to)   = human-readable display label only
 *   pubkey   (fromId/toId) = actual identity — collision-proof, routes encryption
 *   Two users named "Alex" are different because their fromId differs.
 */

export const TTL_START = 5;

export function createPacket({ from, fromId, to, toId, body, pubkey = null }) {
  return {
    id:     Math.random().toString(36).slice(2, 6),
    from,
    fromId,
    to,
    toId,
    ttl:    TTL_START,
    body,
    ...(pubkey && { pubkey }),
    ts:     Date.now(),
  };
}

export function serializePacket(packet) {
  return JSON.stringify(packet);
}

export function deserializePacket(raw) {
  try {
    const p = JSON.parse(raw);
    // fromId and toId are required for identity-based routing
    if (!p.id || !p.from || !p.fromId || !p.to || !p.toId || p.ttl === undefined || !p.body) return null;
    return p;
  } catch {
    return null;
  }
}
```

---

### Contract 2 — Transport

`src/contracts/TransportContract.js`

What the BLE layer must provide. Router and UI talk to BleManager only through these.

```js
/**
 * TRANSPORT CONTRACT
 * BleManager must implement this interface exactly.
 *
 * Constructor callbacks (injected at construction):
 *   onPacketReceived(packet: Packet, fromDeviceId: string) → void
 *   onPeerConnected(deviceId: string, name: string) → void
 *   onPeerDisconnected(deviceId: string) → void
 *
 * Methods:
 *   start() → Promise<void>                    Start scanning + advertising
 *   stop() → Promise<void>                     Stop everything cleanly
 *   sendPacket(packet, excludeId?) → void      Send to all peers except excludeId
 *   getPeerIds() → string[]                    List of connected device IDs
 */
```

---

### Contract 3 — Router

`src/contracts/RouterContract.js`

What the router must provide to ChatScreen.

```js
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
```

---

### Contract 4 — Crypto

`src/contracts/CryptoContract.js`

The encryption interface. Skipped now, dropped in later. Router always calls this — when encryption is off it is a passthrough.

```js
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

```

### Contract 5 — Identity

`src/contracts/IdentityContract.js`

The shape of a user identity object. Used by QR encoding, SetupScreen, and the router.

```js
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
```

---

## The Mocks (so everyone can build independently)

These go in `src/mocks/`. Used during development. Replaced by real implementations on integration day.

---

### MockTransport

`src/mocks/MockTransport.js`

Dev B and Dev C use this to build router and UI without real BLE.

```js
import { createPacket } from '../contracts/Packet';

const FAKE_PUBKEY_1 = 'fakepubkey_alice_sim_base64==';
const FAKE_PUBKEY_2 = 'fakepubkey_bob_sim_base64==';

export class MockTransport {
  constructor({ onPacketReceived, onPeerConnected, onPeerDisconnected }) {
    this.onPacketReceived = onPacketReceived;
    this.onPeerConnected = onPeerConnected;
    this.onPeerDisconnected = onPeerDisconnected;
    this.peers = ['device-sim-1', 'device-sim-2'];
    this.sent = []; // log of sent packets for testing
  }

  async start() {
    // Simulate two peers connecting after 1 second
    setTimeout(() => {
      this.onPeerConnected('device-sim-1', 'Alice-Sim');
      this.onPeerConnected('device-sim-2', 'Bob-Sim');
    }, 1000);
  }

  async stop() {}

  sendPacket(packet, excludeId = null) {
    this.sent.push({ packet, excludeId });
    console.log('[MockTransport] sendPacket:', packet);
  }

  getPeerIds() { return this.peers; }

  // Test helper — fake a packet arriving from outside
  // Uses fake pubkeys so router can test identity-based routing
  simulateIncoming(fromNickname, toNickname, body, fromPubkey = FAKE_PUBKEY_1, toPubkey = FAKE_PUBKEY_2) {
    const packet = createPacket({
      from:   fromNickname,
      fromId: fromPubkey,
      to:     toNickname,
      toId:   toPubkey,
      body,
      pubkey: fromPubkey,
    });
    this.onPacketReceived(packet, 'device-sim-1');
  }
}
```

---

### MockRouter

`src/mocks/MockRouter.js`

Dev C uses this to build UI without needing a real router.

```js
export class MockRouter {
  send(to, body) {
    console.log(`[MockRouter] send to=${to} body=${body}`);
  }
  start() {}
  stop() {}
}
```

---

### NullCrypto

`src/mocks/NullCrypto.js`

Passthrough crypto. This is what makes encryption a drop-in — swap NullCrypto for RealCrypto and nothing else changes.

```js
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
```

---

## Feature A — BLE Transport

**Owner:** Dev A (Mac #1)
**Depends on:** Packet contract only
**Blocks nobody:** others use MockTransport until this is ready

### File structure
```
src/ble/
  constants.js      UUIDs shared across iOS and Android
  BleManager.js     implements TransportContract
  BleAdvertiser.js  advertising (iOS: CoreBluetooth, Android: ble-advertiser)
```

### src/ble/constants.js
```js
// Full 128-bit UUIDs required for Android compatibility
export const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
export const CHAR_UUID    = 'abcdefab-1234-1234-1234-abcdefabcdef';
```

### src/ble/BleManager.js
```js
import { BleManager as PlxManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { SERVICE_UUID, CHAR_UUID } from './constants';
import { deserializePacket, serializePacket } from '../contracts/Packet';
import { Buffer } from 'buffer';

export class BleManager {
  constructor({ onPacketReceived, onPeerConnected, onPeerDisconnected }) {
    this.manager = new PlxManager();
    this.connectedDevices = new Map();
    this.onPacketReceived = onPacketReceived;
    this.onPeerConnected = onPeerConnected;
    this.onPeerDisconnected = onPeerDisconnected;
  }

  async start() {
    await this._requestPermissions();
    await this._waitForPowerOn();
    this._scan();
    // BleAdvertiser.startAdvertising() called separately
  }

  async stop() {
    this.manager.stopDeviceScan();
    this.manager.destroy();
  }

  async sendPacket(packet, excludeDeviceId = null) {
    const encoded = Buffer.from(serializePacket(packet)).toString('base64');
    const targets = [...this.connectedDevices.entries()]
      .filter(([id]) => id !== excludeDeviceId);
    for (const [id, device] of targets) {
      try {
        await device.writeCharacteristicWithResponseForService(
          SERVICE_UUID, CHAR_UUID, encoded
        );
      } catch (e) {
        console.warn('[BLE] send failed to', id, e.message);
      }
    }
  }

  getPeerIds() {
    return [...this.connectedDevices.keys()];
  }

  async _requestPermissions() {
    if (Platform.OS !== 'android') return;
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
  }

  async _waitForPowerOn() {
    return new Promise(resolve => {
      const sub = this.manager.onStateChange(state => {
        if (state === 'PoweredOn') { sub.remove(); resolve(); }
      }, true);
    });
  }

  _scan() {
    this.manager.startDeviceScan(
      [SERVICE_UUID],
      { allowDuplicates: false, ...(Platform.OS === 'android' && { scanMode: 2 }) },
      async (error, device) => {
        if (error || !device || this.connectedDevices.has(device.id)) return;
        try { await this._connect(device); }
        catch (e) { console.warn('[BLE] connect failed:', e.message); }
      }
    );
  }

  async _connect(device) {
    const connected = await device.connect({ timeout: 10000 });
    if (Platform.OS === 'android') await connected.requestMTU(512);
    await connected.discoverAllServicesAndCharacteristics();

    this.connectedDevices.set(device.id, connected);
    this.onPeerConnected(device.id, device.name ?? 'Unknown');

    connected.monitorCharacteristicForService(SERVICE_UUID, CHAR_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        const raw = Buffer.from(characteristic.value, 'base64').toString('utf8');
        const packet = deserializePacket(raw);
        if (packet) this.onPacketReceived(packet, device.id);
      }
    );

    connected.onDisconnected(() => {
      this.connectedDevices.delete(device.id);
      this.onPeerDisconnected(device.id);
      setTimeout(() => this._scan(), 2000);
    });
  }
}
```

### Incremental Tests for Feature A

**Test A1 — Advertising visible externally**
```
1. Run app on iPhone A
2. Open nRF Connect on iPhone B (separate app, no code needed)
3. Scan in nRF Connect → look for SERVICE_UUID
YES → advertising works
NO  → check Info.plist entries
```

**Test A2 — Two phones connect**
```
1. Run app on iPhone A and iPhone B
2. Watch console on both
3. Should see: [BLE] peerConnected logged on both
```

**Test A3 — Raw packet exchange**
```
Temporarily add a test button in App.js:
  <Button title="Ping" onPress={() =>
    transport.sendPacket(createPacket('me', 'all', 'ping'))
  }/>
Press on iPhone A — iPhone B console logs the received packet
```

---

## Feature B — Mesh Router

**Owner:** Dev B (Mac #2)
**Depends on:** TransportContract (use MockTransport), Packet contract
**Blocks nobody:** others use MockRouter until this is ready

### File structure
```
src/mesh/
  MeshRouter.js     implements RouterContract
  peerManager.js    tracks connected peers, exposes list to UI
```

### src/mesh/MeshRouter.js
```js
import { createPacket } from '../contracts/Packet';

export class MeshRouter {
  /**
   * @param {Object} identity   - { nickname, pubkey } — local user's identity
   * @param transport           - satisfies TransportContract
   * @param crypto              - satisfies CryptoContract
   * @param onMessageForMe      - callback({ id, from, fromId, to, toId, body, ts })
   */
  constructor(identity, transport, crypto, onMessageForMe) {
    this.identity = identity;       // { nickname, pubkey }
    this.transport = transport;
    this.crypto = crypto;
    this.onMessageForMe = onMessageForMe;
    this.seen = new Map();          // id → timestamp
    this.SEEN_TTL_MS = 60_000;
  }

  start() {
    this.transport.onPacketReceived = this._handleIncoming.bind(this);
  }

  stop() {
    this.transport.onPacketReceived = null;
  }

  // Called by ChatScreen
  // toId = recipient's pubkey (their actual identity)
  send(toNickname, toId, body) {
    const encryptedBody = toId === 'all'
      ? body
      : this._tryEncrypt(body, toId);

    const packet = createPacket({
      from:   this.identity.nickname,
      fromId: this.identity.pubkey,
      to:     toNickname,
      toId,
      body:   encryptedBody,
      pubkey: this.identity.pubkey,  // always broadcast your pubkey
    });

    this.seen.set(packet.id, Date.now());
    this.transport.sendPacket(packet);
  }

  _handleIncoming(packet, fromDeviceId) {
    // Register sender identity if pubkey present
    if (packet.pubkey && packet.from) {
      this.crypto.registerPeerKey(packet.pubkey, packet.from);
    }

    // Deduplicate
    if (this.seen.has(packet.id)) return;
    this.seen.set(packet.id, Date.now());
    this._pruneSeenCache();

    // Is it for me? Match on pubkey (toId), not nickname
    const isForMe = packet.toId === this.identity.pubkey;
    const isBroadcast = packet.toId === 'all';

    if (isForMe || isBroadcast) {
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
    }

    // Relay if TTL allows
    if (packet.ttl > 1) {
      this.transport.sendPacket(
        { ...packet, ttl: packet.ttl - 1 },
        fromDeviceId
      );
    }
  }

  _tryEncrypt(body, recipientPubKey) {
    const key = this.crypto.getPeerKey(recipientPubKey);
    if (!key) return body;
    try { return this.crypto.encrypt(body, key); }
    catch { return body; }
  }

  _tryDecrypt(body, senderPubKey) {
    const key = this.crypto.getPeerKey(senderPubKey);
    if (!key) return body;
    try { return this.crypto.decrypt(body, key); }
    catch { return body; }
  }

  _pruneSeenCache() {
    const now = Date.now();
    for (const [id, ts] of this.seen) {
      if (now - ts > this.SEEN_TTL_MS) this.seen.delete(id);
    }
  }
}
```

### src/mesh/peerManager.js
```js
export class PeerManager {
  constructor(onPeersChanged) {
    this.peers = new Map(); // deviceId → { deviceId, name, connectedAt }
    this.onPeersChanged = onPeersChanged;
  }

  onPeerConnected(deviceId, name) {
    this.peers.set(deviceId, { deviceId, name, connectedAt: Date.now() });
    this.onPeersChanged([...this.peers.values()]);
  }

  onPeerDisconnected(deviceId) {
    this.peers.delete(deviceId);
    this.onPeersChanged([...this.peers.values()]);
  }

  getPeers() { return [...this.peers.values()]; }
  getCount() { return this.peers.size; }
}
```

### Incremental Tests for Feature B

All of these run with MockTransport — no phones needed.

**Test B1 — Message delivered to self**
```js
const transport = new MockTransport({ onPacketReceived: () => {}, onPeerConnected: () => {}, onPeerDisconnected: () => {} });
const router = new MeshRouter('bob', transport, new NullCrypto(), (msg) => {
  console.log('RECEIVED:', msg.body); // should print "hello bob"
});
router.start();
transport.simulateIncoming('alice', 'bob', 'hello bob');
```

**Test B2 — Message not for me gets relayed**
```js
transport.simulateIncoming('alice', 'charlie', 'hello charlie');
console.log(transport.sent.length); // 1 — relayed
// RECEIVED should NOT fire — not for bob
```

**Test B3 — Duplicate dropped**
```js
const packet = createPacket('alice', 'charlie', 'hello');
transport.onPacketReceived(packet, 'device-1');
transport.onPacketReceived(packet, 'device-1'); // same packet again
console.log(transport.sent.length); // still 1, not 2
```

**Test B4 — TTL=1 dropped, not relayed**
```js
const packet = createPacket('alice', 'charlie', 'hello');
packet.ttl = 1;
transport.onPacketReceived(packet, 'device-1');
console.log(transport.sent.length); // 0 — dropped
```

**Test B5 — Broadcast delivered to self AND relayed**
```js
transport.simulateIncoming('alice', 'all', 'everyone hear me');
// RECEIVED fires (to === 'all')
// transport.sent.length === 1 (also relayed)
```

---

## Feature C — UI + State

**Owner:** Dev C (Windows)
**Depends on:** RouterContract (use MockRouter), Packet contract
**Blocks nobody:** UI is a leaf node

### File structure
```
src/screens/
  SetupScreen.js      nickname input, generates identity, persists to AsyncStorage
  ProfileScreen.js    shows YOUR QR code (your pubkey encoded)
  ScanScreen.js       camera → scans QR → registers contact
  ContactsScreen.js   list of scanned contacts → tap to open chat
  ChatScreen.js       message thread + composer

src/state/
  AppContext.js     global state: identity, messages, peers, contacts
```

### src/state/AppContext.js
```js
import React, { createContext, useContext, useReducer } from 'react';

const initialState = {
  identity:  null,   // { nickname, pubkey } — set on SetupScreen, persisted
  messages:  [],     // { id, from, fromId, to, toId, body, ts }[]
  peers:     [],     // { deviceId, name, connectedAt }[]
  contacts:  [],     // { nickname, pubkey }[] — added via QR scan
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_IDENTITY':
      return { ...state, identity: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_PEERS':
      return { ...state, peers: action.payload };
    case 'ADD_CONTACT': {
      // Prevent duplicate contacts by pubkey
      const exists = state.contacts.some(c => c.pubkey === action.payload.pubkey);
      if (exists) return state;
      return { ...state, contacts: [...state.contacts, action.payload] };
    }
    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
```

### src/screens/ChatScreen.js
```js
import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useApp } from '../state/AppContext';

/**
 * Props:
 *   router: satisfies RouterContract — exposes .send(toNickname, toId, body)
 *   contact: { nickname, pubkey }  — the recipient's identity
 *
 * ChatScreen knows nothing about BLE or packets.
 * It routes by pubkey (toId) — two users named "Alex" are never confused.
 */
export function ChatScreen({ router, contact }) {
  const { state, dispatch } = useApp();
  const [input, setInput] = useState('');
  const myPubkey = state.identity?.pubkey;

  const thread = state.messages.filter(m =>
    (m.fromId === myPubkey        && m.toId === contact.pubkey) ||
    (m.fromId === contact.pubkey  && m.toId === myPubkey)
  );

  const send = () => {
    if (!input.trim()) return;
    router.send(contact.nickname, contact.pubkey, input.trim());
    dispatch({ type: 'ADD_MESSAGE', payload: {
      id:     Date.now().toString(),
      from:   state.identity.nickname,
      fromId: myPubkey,
      to:     contact.nickname,
      toId:   contact.pubkey,
      body:   input.trim(),
      ts:     Date.now(),
    }});
    setInput('');
  };

  return (
    <View style={s.container}>
      <FlatList
        data={thread}
        keyExtractor={m => m.id}
        renderItem={({ item }) => (
          <View style={[s.bubble, item.fromId === myPubkey ? s.mine : s.theirs]}>
            <Text style={s.body}>{item.body}</Text>
            <Text style={s.meta}>{item.from} · {new Date(item.ts).toLocaleTimeString()}</Text>
          </View>
        )}
      />
      <View style={s.composer}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message..."
          placeholderTextColor="#666"
        />
        <TouchableOpacity style={s.btn} onPress={send}>
          <Text style={s.btnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  bubble:    { margin: 8, padding: 10, borderRadius: 12, maxWidth: '75%' },
  mine:      { backgroundColor: '#2563eb', alignSelf: 'flex-end' },
  theirs:    { backgroundColor: '#222', alignSelf: 'flex-start' },
  body:      { color: '#fff', fontSize: 15 },
  meta:      { color: '#aaa', fontSize: 11, marginTop: 4 },
  composer:  { flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: '#333' },
  input:     { flex: 1, backgroundColor: '#222', color: '#fff', borderRadius: 8, padding: 10 },
  btn:       { marginLeft: 8, backgroundColor: '#2563eb', borderRadius: 8, padding: 10, justifyContent: 'center' },
  btnText:   { color: '#fff', fontWeight: 'bold' },
});
```

### Incremental Test for Feature C

**Test C1 — Full UI works with zero BLE**
```
Dev C runs app on simulator/emulator
MockTransport auto-connects two fake peers after 1 second
MockRouter.send() logs to console
Tap a peer → ChatScreen opens
Type and send a message → appears in the list
simulateIncoming() fires → message appears from the other side
All of this with no phones, no BLE, no cable
```

---

## Feature D — Identity + QR

**Owner:** Dev C (Windows), after SetupScreen is done
**Depends on:** IdentityContract, CryptoContract, AppContext
**Blocks:** Encryption (needs identity before keys mean anything)

### New libraries needed
```bash
npx expo install react-native-qrcode-svg    # show QR code
npx expo install expo-camera                # scan QR codes
```

### File structure
```
src/screens/
  SetupScreen.js      nickname input → generates identity → stores it
  ProfileScreen.js    shows YOUR QR code (your pubkey encoded)
  ScanScreen.js       camera → scans QR → registers contact
  ContactsScreen.js   list of scanned contacts → tap to open chat
```

### How Identity is Created (SetupScreen)

On first launch, SetupScreen asks for a nickname. When confirmed, it calls `crypto.initialize()` which generates the keypair and returns the identity. This identity is stored in AsyncStorage and in AppContext.

```js
// src/screens/SetupScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../state/AppContext';

export function SetupScreen({ crypto }) {
  const { dispatch } = useApp();
  const [nickname, setNickname] = useState('');

  const confirm = async () => {
    if (!nickname.trim()) return;

    // crypto.initialize() generates keypair and returns identity
    const { pubkey } = await crypto.initialize();
    const identity = { nickname: nickname.trim(), pubkey };

    // Persist so we survive app restarts
    await AsyncStorage.setItem('identity', JSON.stringify(identity));
    dispatch({ type: 'SET_IDENTITY', payload: identity });
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Choose your name</Text>
      <TextInput
        style={s.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder="Your nickname..."
        placeholderTextColor="#666"
        maxLength={24}
      />
      <TouchableOpacity style={s.btn} onPress={confirm}>
        <Text style={s.btnText}>Start</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title:     { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  input:     { width: '100%', backgroundColor: '#222', color: '#fff', borderRadius: 8, padding: 14, fontSize: 16, marginBottom: 16 },
  btn:       { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, width: '100%', alignItems: 'center' },
  btnText:   { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
```

### ProfileScreen — Your QR Code

```js
// src/screens/ProfileScreen.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { encodeIdentityForQR } from '../contracts/IdentityContract';
import { useApp } from '../state/AppContext';

export function ProfileScreen() {
  const { state } = useApp();
  const { identity } = state;

  if (!identity) return null;

  const qrValue = encodeIdentityForQR(identity);

  return (
    <View style={s.container}>
      <Text style={s.name}>{identity.nickname}</Text>
      <Text style={s.sub}>Scan this to add me as a contact</Text>
      <View style={s.qrBox}>
        <QRCode
          value={qrValue}
          size={220}
          backgroundColor="#fff"
          color="#000"
        />
      </View>
      <Text style={s.id} numberOfLines={1} ellipsizeMode="middle">
        ID: {identity.pubkey}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 32 },
  name:      { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  sub:       { color: '#888', fontSize: 14, marginBottom: 32 },
  qrBox:     { backgroundColor: '#fff', padding: 16, borderRadius: 12 },
  id:        { color: '#555', fontSize: 11, marginTop: 24, maxWidth: '100%' },
});
```

### ScanScreen — Scan Someone's QR

```js
// src/screens/ScanScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { decodeIdentityFromQR } from '../contracts/IdentityContract';
import { useApp } from '../state/AppContext';

export function ScanScreen({ navigation, crypto }) {
  const { dispatch } = useApp();
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission?.granted) {
    requestPermission();
    return null;
  }

  const handleScan = ({ data }) => {
    if (scanned) return;
    setScanned(true);

    const contact = decodeIdentityFromQR(data);
    if (!contact) {
      Alert.alert('Invalid QR', 'This QR code is not a valid contact.');
      setScanned(false);
      return;
    }

    // Register their public key in crypto layer
    crypto.registerPeerKey(contact.pubkey, contact.nickname);

    // Add to contacts list in state
    dispatch({ type: 'ADD_CONTACT', payload: contact });

    Alert.alert(
      'Contact added',
      `${contact.nickname} added to your contacts.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <View style={s.container}>
      <CameraView
        style={s.camera}
        onBarcodeScanned={handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <Text style={s.hint}>Point at someone's profile QR code</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera:    { flex: 1 },
  hint:      { color: '#fff', textAlign: 'center', padding: 16, backgroundColor: '#111' },
});
```

### ContactsScreen — Your Contact List

```js
// src/screens/ContactsScreen.js
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useApp } from '../state/AppContext';

/**
 * Shows scanned contacts.
 * Tap a contact → navigate to ChatScreen with that contact's identity.
 */
export function ContactsScreen({ navigation, router }) {
  const { state } = useApp();

  return (
    <View style={s.container}>
      <FlatList
        data={state.contacts}
        keyExtractor={c => c.pubkey}
        ListEmptyComponent={
          <Text style={s.empty}>No contacts yet. Scan someone's QR code to add them.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.row}
            onPress={() => navigation.navigate('Chat', { contact: item, router })}
          >
            <Text style={s.name}>{item.nickname}</Text>
            <Text style={s.id} numberOfLines={1} ellipsizeMode="middle">
              {item.pubkey}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  empty:     { color: '#555', textAlign: 'center', marginTop: 48, paddingHorizontal: 32 },
  row:       { padding: 16, borderBottomWidth: 1, borderColor: '#222' },
  name:      { color: '#fff', fontSize: 16, fontWeight: '600' },
  id:        { color: '#555', fontSize: 11, marginTop: 4 },
});
```

### QR System Data Flow

```
Alice opens ProfileScreen
  → QR displays encodeIdentityForQR({ nickname: 'Alice', pubkey: 'abc123...' })

Bob opens ScanScreen → points camera at Alice's QR
  → decodeIdentityFromQR(scannedData) → { nickname: 'Alice', pubkey: 'abc123...' }
  → crypto.registerPeerKey('abc123...', 'Alice')
  → dispatch ADD_CONTACT { nickname: 'Alice', pubkey: 'abc123...' }

Bob opens ContactsScreen → taps Alice
  → ChatScreen opens with contact = { nickname: 'Alice', pubkey: 'abc123...' }
  → router.send('Alice', 'abc123...', 'hey!')
  → packet.toId = 'abc123...'

Alice receives packet
  → packet.toId === alice.identity.pubkey → it is for me
  → display message
```

### Incremental Tests for Feature D

**Test D1 — QR encodes and decodes correctly**
```js
const identity = { nickname: 'alice', pubkey: 'abc123==' };
const qr = encodeIdentityForQR(identity);
const decoded = decodeIdentityFromQR(qr);
console.log(decoded.pubkey === 'abc123=='); // true
console.log(decoded.nickname === 'alice');   // true
```

**Test D2 — Invalid QR returns null**
```js
console.log(decodeIdentityFromQR('not json'));     // null
console.log(decodeIdentityFromQR('{"foo":"bar"}')); // null — missing required fields
```

**Test D3 — Duplicate contact not added twice**
```js
dispatch({ type: 'ADD_CONTACT', payload: { nickname: 'alice', pubkey: 'abc123==' } });
dispatch({ type: 'ADD_CONTACT', payload: { nickname: 'alice', pubkey: 'abc123==' } });
console.log(state.contacts.length); // 1, not 2
```

---

## Feature E — Encryption (drop-in after A+B+C+D work)

**Owner:** any dev, after the demo is solid
**Drop-in point:** one line in App.js — nothing else changes

### src/crypto/RealCrypto.js
```js
import _sodium from 'libsodium-wrappers';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class RealCrypto {
  constructor() {
    this.sodium = null;
    this.publicKey = null;
    this.privateKey = null;
    this.peerKeys = new Map(); // nickname → Uint8Array
  }

  async initialize() {
    await _sodium.ready;
    this.sodium = _sodium;

    const stored = await AsyncStorage.getItem('keypair_v1');
    if (stored) {
      const { pub, priv } = JSON.parse(stored);
      this.publicKey = this.sodium.from_base64(pub);
      this.privateKey = this.sodium.from_base64(priv);
    } else {
      const pair = this.sodium.crypto_box_keypair();
      this.publicKey = pair.publicKey;
      this.privateKey = pair.privateKey;
      await AsyncStorage.setItem('keypair_v1', JSON.stringify({
        pub:  this.sodium.to_base64(this.publicKey),
        priv: this.sodium.to_base64(this.privateKey),
      }));
    }
  }

  getPublicKey() {
    return this.sodium.to_base64(this.publicKey);
  }

  // Indexed by pubkey — collision-proof identity
  registerPeerKey(pubkey, nickname) {
    this.peerKeys.set(pubkey, this.sodium.from_base64(pubkey));
    this.peerNicknames = this.peerNicknames || new Map();
    this.peerNicknames.set(pubkey, nickname);
  }

  getPeerKey(pubkey) {
    const k = this.peerKeys.get(pubkey);
    return k ? this.sodium.to_base64(k) : null;
  }

  getNickname(pubkey) {
    return this.peerNicknames?.get(pubkey) ?? null;
  }

  encrypt(body, recipientPubKeyB64) {
    const recipientKey = this.sodium.from_base64(recipientPubKeyB64);
    const nonce = this.sodium.randombytes_buf(this.sodium.crypto_box_NONCEBYTES);
    const encrypted = this.sodium.crypto_box_easy(
      this.sodium.from_string(body), nonce, recipientKey, this.privateKey
    );
    return JSON.stringify({
      n: this.sodium.to_base64(nonce),
      d: this.sodium.to_base64(encrypted),
    });
  }

  decrypt(body, senderPubKeyB64) {
    const { n, d } = JSON.parse(body);
    const senderKey = this.sodium.from_base64(senderPubKeyB64);
    const decrypted = this.sodium.crypto_box_open_easy(
      this.sodium.from_base64(d),
      this.sodium.from_base64(n),
      senderKey,
      this.privateKey
    );
    return this.sodium.to_string(decrypted);
  }
}
```

### How to enable encryption — one line change

```js
// App.js BEFORE (no encryption):
import { NullCrypto } from './src/mocks/NullCrypto';
const crypto = new NullCrypto();

// App.js AFTER (encryption on):
import { RealCrypto } from './src/crypto/RealCrypto';
const crypto = new RealCrypto();
await crypto.initialize();

// Router does not change.
// BLE does not change.
// UI does not change.
```

---

## App.js — The Wiring Layer

The only file that imports everything and connects it. All other files stay isolated.

```js
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, useApp } from './src/state/AppContext';
import { BleManager } from './src/ble/BleManager';
import { MeshRouter } from './src/mesh/MeshRouter';
import { PeerManager } from './src/mesh/peerManager';
import { NullCrypto } from './src/mocks/NullCrypto';
// swap the line above for this when adding encryption:
// import { RealCrypto } from './src/crypto/RealCrypto';

function AppInner() {
  const { state, dispatch } = useApp();
  const [router, setRouter] = useState(null);

  // On launch — restore persisted identity if it exists
  useEffect(() => {
    AsyncStorage.getItem('identity').then(stored => {
      if (stored) {
        dispatch({ type: 'SET_IDENTITY', payload: JSON.parse(stored) });
      }
    });
  }, []);

  useEffect(() => {
    if (!state.identity) return;

    const crypto = new NullCrypto();
    // const crypto = new RealCrypto(); await crypto.initialize(); // ← swap for encryption

    const peerManager = new PeerManager((peers) =>
      dispatch({ type: 'SET_PEERS', payload: peers })
    );

    const meshRouter = new MeshRouter(
      state.identity,           // { nickname, pubkey } — full identity
      null,
      crypto,
      (message) => dispatch({ type: 'ADD_MESSAGE', payload: message })
    );

    const transport = new BleManager({
      onPacketReceived:   (packet, fromId) => meshRouter._handleIncoming(packet, fromId),
      onPeerConnected:    (id, name) => peerManager.onPeerConnected(id, name),
      onPeerDisconnected: (id) => peerManager.onPeerDisconnected(id),
    });

    meshRouter.transport = transport;
    transport.start();
    setRouter(meshRouter);

    return () => transport.stop();
  }, [state.identity]);

  // No identity yet → show setup
  if (!state.identity) return <SetupScreen crypto={new NullCrypto()} />;
  return <MainNavigator router={router} />;
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
```

---

## Integration Milestones

```
Milestone 1 — Router + MockTransport (Dev B alone)
  MeshRouter tests B1–B5 all pass
  No phones needed

Milestone 2 — UI + MockRouter (Dev C alone)
  SetupScreen creates identity
  ContactsScreen shows contacts
  ChatScreen sends and receives messages
  All working on simulator, no BLE

Milestone 3 — QR System (Dev C alone)
  ProfileScreen shows a valid QR
  ScanScreen reads it back and registers the contact
  Contacts appear in ContactsScreen
  Tests D1–D3 pass

Milestone 4 — BLE + Router (Dev A + Dev B)
  Replace MockTransport with real BleManager
  2 iPhones exchange a message end to end

Milestone 5 — Full stack (all devs)
  3 iPhones running
  Scan QR to add each other as contacts
  A sends to C through B
  B's ChatScreen shows nothing
  C receives the message

Milestone 6 — Encryption drop-in (stretch)
  Swap NullCrypto for RealCrypto in App.js
  Re-run Milestone 5
  Same result — now cryptographically guaranteed
```

---

## Parallel Work Timeline

```
Hour 0–1    ALL: read contracts, agree on them, commit to repo
            Nobody writes feature code until contracts are merged

Hour 1–3    SETUP
  Dev A: Expo prebuild, pod install, blank app on iPhone
  Dev B: clone repo, run simulator with MockTransport
  Dev C: clone repo, run emulator with MockTransport + MockRouter

Hour 3–8    BUILD IN PARALLEL
  Dev A: BleManager.js → pass Tests A1, A2, A3
  Dev B: MeshRouter.js → pass Tests B1–B5
  Dev C: SetupScreen + ChatScreen + ContactsScreen → pass Test C1

Hour 8–10   QR SYSTEM (Dev C)
  ProfileScreen with QR display
  ScanScreen with camera
  Tests D1–D3 pass

Hour 10–12  MILESTONE 4 — Dev A + Dev B
  Wire BleManager into MeshRouter
  2 iPhones exchange a message

Hour 12–15  MILESTONE 5 — all devs
  3 iPhones running
  Scan QR codes to add each other as contacts
  A sends to C through B
  B shows nothing

Hour 15–18  Polish + Android
  Dev C: UI polish
  Dev A: Samsung A20 attempt

Hour 18–22  MILESTONE 6 — encryption (stretch)
  Anyone: implement RealCrypto.js
  Swap NullCrypto → RealCrypto in App.js
  Re-run relay test

Hour 22–24  DEMO PREP
  Guided Access on all iPhones
  Rehearse demo script 3 times
```

---

## The Import Rule

```
You may only import from:
  src/contracts/      shared types and interfaces
  src/mocks/          during development only
  your own feature folder

You may NOT import from:
  another feature's folder directly
  App.js

If you need something from another feature:
  add it to the contract and tell the team.
```

This keeps every feature independently testable and replaceable throughout the 24 hours.
