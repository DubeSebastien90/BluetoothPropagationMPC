# Bluetooth Mesh Chat — Hackathon Build Plan
### 24 Hours · Expo + expo-dev-client · iOS First, Android Stretch

---

## The Pitch

> *"At a festival, everyone is on the same cell tower — SMS fails, Messenger fails, everything fails. This app works purely over Bluetooth. No internet. No WiFi. No cell signal. Just radio waves between phones. If your friend is out of range, the message hops through other users automatically — encrypted the whole way so nobody in between can read it."*

---

## What It Does

- Any phone running the app can send a text message to any other user
- Nearby phones pick it up and relay it further (mesh network)
- The recipient gets the message even if out of direct Bluetooth range
- All routing happens automatically — no user action needed
- Messages are encrypted — relay nodes carry the packet but cannot read it
- Works on airplane mode — zero internet, zero infrastructure

---

## Table of Contents
1. [Tech Stack](#tech-stack)
2. [Devices & Team Split](#devices--team-split)
3. [Project Structure](#project-structure)
4. [Packet Structure](#packet-structure)
5. [BLE Flow](#ble-flow)
6. [Hour-by-Hour Plan](#hour-by-hour-plan)
7. [Core Module Code](#core-module-code)
8. [Hard Cutoffs](#hard-cutoffs)
9. [Demo Script](#demo-script)
10. [Known Gotchas](#known-gotchas)
11. [Final Checklist](#final-checklist)

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| App framework | React Native + Expo | One codebase, all 3 devs contribute |
| Custom native build | `expo-dev-client` | Required for native BLE modules — Expo Go will NOT work |
| BLE scanning + GATT | `react-native-ble-plx` | Most mature RN BLE library, best iOS + Android support |
| BLE advertising | `react-native-ble-advertiser` | Handles advertising on Android (iOS uses CoreBluetooth natively) |
| Encryption | `libsodium-wrappers` | X25519 keypair, simple API, well documented |
| State | Plain React `useState` | No Redux, no Zustand — keep it simple |
| Local persistence | `AsyncStorage` | Nickname + keypair across sessions |
| Target platforms | iOS first, Android stretch | 3 iPhones guaranteed, Android A20 as bonus |

> **Why expo-dev-client and not Expo Go?**
> `react-native-ble-plx` and `react-native-ble-advertiser` are native modules. Expo Go cannot run native modules. You must build a custom dev client via `npx expo run:ios` and install it on the device via cable.

> **Why not bare React Native?**
> Expo with expo-dev-client gives you the same native access as bare RN but with less boilerplate. The Windows dev can still write all shared JS logic and push to Git — Mac devs handle the Xcode builds.

---

## Devices & Team Split

### Devices
| Device | OS | BLE Central | BLE Peripheral | Role in Demo |
|---|---|---|---|---|
| iPhone 12 | iOS 18.3.2 | ✅ | ✅ | Relay node — Phone B |
| iPhone 16 | iOS 26.x | ✅ | ✅ | Sender — Phone A |
| iPhone 17 | iOS 26.x | ✅ | ✅ | Recipient — Phone C |
| Samsung A20 | Android 11 | ✅ | ❌ confirmed | Central-only, connects to iPhones |

> **Samsung A20 note:** Peripheral mode confirmed broken via nRF Connect test. The A20 cannot advertise itself — iPhones will never discover it first. Workaround: open the Android app first, it scans and connects TO the iPhones. Once connected, messaging is fully bidirectional. In the demo, just open Android first.

### Team Split
| Member | Machine | Owns |
|---|---|---|
| Dev A | Mac #1 | BLE core (scanning, advertising, GATT), iOS build & deployment |
| Dev B | Mac #2 | Mesh router, encryption, UI screens |
| Dev C | Windows | Android setup, Android permissions, pitch deck, demo script |

> Dev C cannot build iOS — Xcode is Mac only. They push JS code to Git, Mac devs pull and rebuild. For JS-only changes, Metro hot reload means changes appear on iPhones in seconds without a full rebuild.

---

## Project Structure

```
mesh-chat/
  src/
    ble/
      BleManager.js         ← singleton: scanning, connect, GATT write
      BleAdvertiser.js      ← advertising (iOS: CoreBluetooth, Android: ble-advertiser)
      constants.js          ← SERVICE_UUID + CHAR_UUID hardcoded
    mesh/
      router.js             ← seen-message cache, flood routing, TTL logic
      peerManager.js        ← connected peer list, callbacks
    crypto/
      identity.js           ← X25519 keypair generation + AsyncStorage persistence
      messaging.js          ← encrypt / decrypt helpers using libsodium
    screens/
      SetupScreen.js        ← nickname input on first launch
      ChatScreen.js         ← message list + composer
      PeersScreen.js        ← nearby peers + connection status
    components/
      MessageBubble.js
      PeerBadge.js
      ConnectionBar.js
  App.js
  app.json
  package.json
```

---

## Packet Structure

Every message is a small JSON object serialized to UTF-8 bytes for GATT transfer:

```js
{
  id:      "a3f9",               // 4-char random ID — deduplication key
  from:    "alice",              // sender nickname
  to:      "bob",                // recipient nickname, or "all" for broadcast
  ttl:     5,                    // hops remaining — decremented at each relay
  body:    "meet at stage 3",    // encrypted payload (or plaintext for broadcasts)
  pubkey:  "base64...",          // sender's public key — shared on first packet
  ts:      1718000000000         // timestamp ms
}
```

- Start TTL at **5** — enough for a realistic mesh at a festival
- Each relay decrements TTL by 1, drops at 0
- `pubkey` field lets recipients register your key on first contact — enables encryption without a handshake round-trip
- For broadcasts (`to: "all"`), `body` is plaintext — no recipient key to encrypt with

> **MTU note:** BLE default MTU is 20 bytes — far too small for this packet. Always call `device.requestMTU(512)` immediately on connect. If negotiation fails, chunk the payload manually (see BleManager.js below).

---

## BLE Flow

```
Phone A (sender)
  → advertises SERVICE_UUID

Phone B (nearby scanner)
  → scans with react-native-ble-plx
  → spots SERVICE_UUID
  → connects via GATT
  → negotiates MTU(512)
  → writes packet bytes to CHAR_UUID

Phone A
  → characteristic write received
  → deserializes JSON
  → passes to router.js

router.js on Phone A
  → is this for me? → decrypt + display
  → not for me + TTL > 0? → decrement TTL, forward to all peers
  → already seen this ID? → drop it
```

Both UUID values are hardcoded identically on every device:

```js
// src/ble/constants.js
export const SERVICE_UUID = "12345678-1234-1234-1234-123456789abc";
export const CHAR_UUID    = "abcdefab-1234-1234-1234-abcdefabcdef";
```

---

## Hour-by-Hour Plan

### PHASE 1 — Setup (Hours 0–3)
**Goal: App runs on at least one iPhone. Android builds. Everyone is unblocked.**

#### All devs:
```bash
npx create-expo-app mesh-chat
cd mesh-chat
npx expo install react-native-ble-plx react-native-ble-advertiser
npx expo install @react-native-async-storage/async-storage libsodium-wrappers
npx expo install expo-dev-client
```

#### Dev A + B (Mac) — get on iPhone:
```bash
npx expo prebuild --platform ios
cd ios && pod install && cd ..
```

Open Xcode:
```bash
open ios/meshchat.xcworkspace
```

In Xcode:
```
Click project name → Target: meshchat
→ Signing & Capabilities
→ Team: your Apple Developer account
→ Bundle Identifier: com.yourteam.meshchat
→ Automatically manage signing ✅
```

Plug in iPhone via USB → iPhone: "Trust This Computer" → Trust

```
Xcode top bar → select your iPhone
⌘R → first build ~3-5 min → app installs on phone
iPhone → Settings → General → VPN & Device Management → Trust
```

Required `Info.plist` entries — **BLE silently fails without these:**
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Used to communicate with nearby devices offline</string>

<key>NSBluetoothPeripheralUsageDescription</key>
<string>Used to advertise presence to nearby devices</string>

<key>NSLocalNetworkUsageDescription</key>
<string>Used to discover nearby peers</string>

<key>UIBackgroundModes</key>
<array>
    <string>bluetooth-central</string>
    <string>bluetooth-peripheral</string>
</array>
```

#### Dev C (Windows) — get Android building:
```bash
# Install Android Studio + Android SDK (API 30)
# Samsung A20: Settings → About Phone → tap Build Number 7x → Developer Options → USB Debugging ON
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug
```

Add to `app.json` under `"android"`:
```json
"permissions": [
  "BLUETOOTH",
  "BLUETOOTH_ADMIN",
  "ACCESS_FINE_LOCATION",
  "ACCESS_COARSE_LOCATION"
]
```

> ⛔ **Hour 3 Go/No-Go:** If the app is not running on at least one iPhone by hour 3, the team drops Expo and switches to bare Swift. Agree on this now — no debate at 3am.

---

### PHASE 2 — BLE Core (Hours 3–8)
**Goal: iPhone A sends "hello" → iPhone B receives "hello". Nothing else matters yet.**

This is the highest-risk phase. Focus entirely on raw BLE communication before touching routing or encryption.

Milestone order:
1. iPhone advertises SERVICE_UUID — visible in nRF Connect on another phone ✅
2. Second iPhone scans and finds the first ✅
3. GATT connection established ✅
4. MTU negotiated to 512 ✅
5. Raw string written to CHAR_UUID ✅
6. Received and logged on the other side ✅

Only move to Phase 3 when all 6 milestones are hit.

---

### PHASE 3 — Mesh Router (Hours 8–11)
**Goal: 3-hop relay. A sends to C through B. B never displays the message.**

Wire `router.js` into BleManager. Test the relay scenario with 3 phones in a line.

---

### PHASE 4 — Encryption (Hours 11–14)
**Goal: Messages encrypted. Relay node carries the blob but cannot read it.**

Wire `identity.js` and `messaging.js`. Exchange public keys via the `pubkey` field in the first packet. Encrypt `body` for direct messages. Leave broadcasts plaintext.

> If encryption is causing latency over 500ms or crashing — drop it and mark it "coming soon" in the demo. The relay demo is more important than encryption for the judges.

---

### PHASE 5 — UI (Hours 14–19)
**Goal: Clean enough to demo. Not beautiful — functional.**

Three screens: SetupScreen (nickname), ChatScreen (messages + composer), PeersScreen (who is nearby).

Keep it simple — plain React Native StyleSheet, no UI libraries. Judges look at the BLE magic, not the design.

---

### PHASE 6 — Android (Hours 19–22)
**Only attempt if full iOS demo is solid.**

- Samsung A20 opens app first → scans → finds all iPhones → connects
- Test bidirectional messaging after Android-initiated connection
- Hide advertising status UI on Android (it can't advertise)

```javascript
import { Platform } from 'react-native';

{Platform.OS === 'ios' && <Text>📡 Visible to nearby devices</Text>}
{Platform.OS === 'android' && <Text>🔍 Scanning for nearby devices</Text>}
```

---

### PHASE 7 — Polish & Demo Prep (Hours 22–24)
- Guided Access on all iPhones (locks app open): Settings → Accessibility → Guided Access
- Screen Pinning on Android: Recent Apps → pin the app
- Rehearse demo script 3 times with all devices
- Prepare one diagram slide showing the relay hop

---

## Core Module Code

### src/ble/constants.js
```js
export const SERVICE_UUID = "12345678-1234-1234-1234-123456789abc";
export const CHAR_UUID    = "abcdefab-1234-1234-1234-abcdefabcdef";
```

### src/mesh/router.js
```js
import { v4 as uuidv4 } from 'uuid';

const seen = new Set();
const SEEN_EXPIRY_MS = 60 * 1000;
const seenTimestamps = new Map();

export function handleIncoming(packet, myNickname, peers, onMessageForMe) {
  // Deduplicate — drop if already relayed
  if (seen.has(packet.id)) return;
  seen.add(packet.id);
  seenTimestamps.set(packet.id, Date.now());
  pruneSeenCache();

  // Is it for me or a broadcast?
  if (packet.to === myNickname || packet.to === 'all') {
    onMessageForMe(packet);
  }

  // Relay if TTL allows — even if it was for me, others might need it
  if (packet.ttl > 1) {
    const forwarded = { ...packet, ttl: packet.ttl - 1 };
    peers.forEach(peer => sendPacket(peer, forwarded));
  }
}

export function createPacket(from, to, body, pubkey) {
  return {
    id:     Math.random().toString(36).slice(2, 6), // 4-char ID
    from,
    to,
    ttl:    5,
    body,
    pubkey,
    ts:     Date.now(),
  };
}

function pruneSeenCache() {
  const now = Date.now();
  for (const [id, ts] of seenTimestamps) {
    if (now - ts > SEEN_EXPIRY_MS) {
      seen.delete(id);
      seenTimestamps.delete(id);
    }
  }
}
```

### src/ble/BleManager.js
```js
import { BleManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { SERVICE_UUID, CHAR_UUID } from './constants';
import { Buffer } from 'buffer';

class BLEManager {
  constructor(onMessageReceived, onPeerConnected, onPeerDisconnected) {
    this.manager = new BleManager();
    this.connectedDevices = new Map();
    this.onMessageReceived = onMessageReceived;
    this.onPeerConnected = onPeerConnected;
    this.onPeerDisconnected = onPeerDisconnected;
  }

  async requestPermissions() {
    if (Platform.OS !== 'android') return true;
    // Android 11 (API 30) — simpler than Android 12+
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
  }

  async start() {
    const granted = await this.requestPermissions();
    if (!granted) throw new Error('Bluetooth permissions denied');

    await new Promise(resolve => {
      const sub = this.manager.onStateChange(state => {
        if (state === 'PoweredOn') { sub.remove(); resolve(); }
      }, true);
    });

    this.scan();
  }

  scan() {
    this.manager.startDeviceScan(
      [SERVICE_UUID],
      {
        allowDuplicates: false,
        ...(Platform.OS === 'android' && { scanMode: 2 }) // LOW_LATENCY on Android
      },
      async (error, device) => {
        if (error || !device || this.connectedDevices.has(device.id)) return;
        try { await this.connect(device); }
        catch (e) { console.warn('Connect failed:', e.message); }
      }
    );
  }

  async connect(device) {
    const connected = await device.connect({ timeout: 10000 });

    // Always negotiate MTU — default 20 bytes is too small for our packets
    if (Platform.OS === 'android') {
      await connected.requestMTU(512);
    }

    await connected.discoverAllServicesAndCharacteristics();
    this.connectedDevices.set(device.id, connected);
    this.onPeerConnected(device.id, device.name || 'Unknown');

    // Subscribe to incoming messages
    connected.monitorCharacteristicForService(
      SERVICE_UUID, CHAR_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        const raw = Buffer.from(characteristic.value, 'base64').toString('utf8');
        try { this.onMessageReceived(JSON.parse(raw), device.id); }
        catch (e) { console.warn('Bad packet:', e); }
      }
    );

    connected.onDisconnected(() => {
      this.connectedDevices.delete(device.id);
      this.onPeerDisconnected(device.id);
      setTimeout(() => this.scan(), 2000); // re-scan after disconnect
    });
  }

  async sendPacket(packet, excludeDeviceID = null) {
    const encoded = Buffer.from(JSON.stringify(packet)).toString('base64');
    const targets = [...this.connectedDevices.entries()]
      .filter(([id]) => id !== excludeDeviceID);

    for (const [id, device] of targets) {
      try {
        await device.writeCharacteristicWithResponseForService(
          SERVICE_UUID, CHAR_UUID, encoded
        );
      } catch (e) {
        console.warn('Send failed to', id, e.message);
      }
    }
  }

  getPeers() {
    return [...this.connectedDevices.keys()];
  }

  destroy() {
    this.manager.stopDeviceScan();
    this.manager.destroy();
  }
}

export default BLEManager;
```

### src/crypto/identity.js (stretch)
```js
import _sodium from 'libsodium-wrappers';
import AsyncStorage from '@react-native-async-storage/async-storage';

let sodium;

export async function initCrypto() {
  await _sodium.ready;
  sodium = _sodium;

  const stored = await AsyncStorage.getItem('keypair');
  if (stored) return JSON.parse(stored);

  // Generate X25519 keypair on first launch
  const keypair = sodium.crypto_box_keypair();
  const pair = {
    publicKey: sodium.to_base64(keypair.publicKey),
    privateKey: sodium.to_base64(keypair.privateKey),
  };
  await AsyncStorage.setItem('keypair', JSON.stringify(pair));
  return pair;
}

export function encrypt(message, recipientPublicKeyB64, senderPrivateKeyB64) {
  const recipientKey = sodium.from_base64(recipientPublicKeyB64);
  const senderKey = sodium.from_base64(senderPrivateKeyB64);
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const encrypted = sodium.crypto_box_easy(
    sodium.from_string(message), nonce, recipientKey, senderKey
  );
  return JSON.stringify({
    nonce: sodium.to_base64(nonce),
    data: sodium.to_base64(encrypted),
  });
}

export function decrypt(payload, senderPublicKeyB64, recipientPrivateKeyB64) {
  const { nonce, data } = JSON.parse(payload);
  const senderKey = sodium.from_base64(senderPublicKeyB64);
  const recipientKey = sodium.from_base64(recipientPrivateKeyB64);
  const decrypted = sodium.crypto_box_open_easy(
    sodium.from_base64(data),
    sodium.from_base64(nonce),
    senderKey,
    recipientKey
  );
  return sodium.to_string(decrypted);
}
```

---

## Hard Cutoffs

Agree on these BEFORE starting. No debate when the time comes.

| Time | Checkpoint | If failing |
|---|---|---|
| Hour 3 | App running on one iPhone | Drop Expo, switch to bare Swift |
| Hour 5 | iPhone ↔ iPhone raw BLE message works | Stay on this until it works — everything else waits |
| Hour 8 | 3-hop relay working on 3 iPhones | Drop encryption, do plaintext demo |
| Hour 14 | Encryption working | Mark as stretch, skip in demo |
| Hour 19 | Full iOS demo solid end-to-end | Skip Android entirely |
| Hour 22 | Android connects + messages iPhones | Drop Android from demo script |

> **The rule:** A clean 3-iPhone demo is better than a broken 4-device demo. Cut early, cut without debate.

---

## Demo Script

**Before judges arrive:**
1. Airplane mode on all devices
2. WiFi OFF — Bluetooth ON
3. Open app on all devices
4. Wait for peer count to show "connected" (~5–10 seconds)

**The demo:**

1. *"All phones are in airplane mode. No internet, no cell signal, no WiFi. Pure Bluetooth only."*
2. *"They found each other automatically in about 5 seconds."*
3. Hand the iPhone 12 (relay) to a judge — show them its screen
4. Send a message from iPhone 16 addressed to iPhone 17
5. *"Watch the relay phone — it received the packet and forwarded it. But nothing appeared on screen. Because the message is encrypted with the recipient's public key. The relay is just carrying noise it can't read."*
6. iPhone 17 receives and displays the message
7. *"This works at any festival, any stadium, any dead zone. As long as one person in the crowd has the app, your message gets through."*

**Bonus if Android is working:**
> *"And this Samsung is on Android, in airplane mode. Same app. It found the iPhones automatically and joined the mesh."*

---

## Known Gotchas

| Gotcha | Details | Fix |
|---|---|---|
| Expo Go won't work | Native BLE modules need custom dev client | Use `npx expo run:ios` via cable |
| BLE silent failures on iOS | Missing Info.plist keys cause zero errors | Add all 4 plist entries before first build |
| Android location permission | Required for BLE scanning on Android 11 and below even though you don't use location | Add ACCESS_FINE_LOCATION or scan returns nothing |
| MTU 20 byte default | Too small for any real packet | Call requestMTU(512) immediately on every connect |
| Samsung A20 can't advertise | Confirmed broken — iPhones can't discover it | Open Android app first — it finds iPhones |
| iOS background BLE | App backgrounded = scanning pauses | Keep app foregrounded during demo, use Guided Access |
| react-native-ble-advertiser is Android only | iOS advertising uses CoreBluetooth, not this library | Handle advertising separately per platform |
| Flood routing congestion | At scale, every node relays every message | Fine for hackathon — TTL of 5 limits it enough |
| pod install failures | Common on first setup | Run `sudo gem install cocoapods` before starting |

---

## Stretch Goals

If time permits after a solid demo:

- **PeersScreen** — signal strength (RSSI), hop count to each peer
- **Broadcast mode** — `to: "all"` sends to every device in the mesh
- **Fixed relay nodes** — Raspberry Pi Zero W (~$15) running the same relay logic in Python, deployed around the venue as infrastructure nodes
- **Forward secrecy** — rotate session keys per conversation

---

## Final Checklist

- [ ] All phones in airplane mode, WiFi off, Bluetooth on
- [ ] App installed on all 3 iPhones via cable
- [ ] Peers auto-connect within 10 seconds of opening app
- [ ] Direct message A→B works
- [ ] Relay A→B→C works — C receives, B shows nothing
- [ ] Encryption working (or cleanly cut from demo)
- [ ] Guided Access active on all iPhones
- [ ] Demo script rehearsed 3 times
- [ ] One-liner memorized: *"Bluetooth mesh chat. No internet. Encrypted relay. Works at festivals."*

---

*Built for hackathon · 24h · Expo + expo-dev-client + react-native-ble-plx*
