# toot 📡

**Offline Bluetooth mesh chat for festivals, protests, emergencies, and anywhere the internet fails you.**

No WiFi. No cell service. No servers. Just people talking to people, phone to phone.

---

## What is it?

toot is a peer-to-peer chat app that works entirely over Bluetooth Low Energy. Every phone in range becomes a node in a mesh network — messages hop from device to device until they reach their destination, even if the sender and receiver can't see each other directly.

You can be in a crowd of 10,000 people with no signal and still talk to your friends.

---

## Features

**Direct messages** — Encrypted one-on-one chat. Add contacts by scanning each other's QR codes. Messages are end-to-end encrypted using NaCl (the same cryptography used by Signal).

**Broadcast** — Send a message to everyone in the mesh. Great for announcements, finding lost people, or just vibes.

**Topics** — Subscribe to a named channel like `mainstage` or `camp-a`. Anyone who subscribes to the same name sees the same messages. No invite needed — just share the name verbally.

**Meeting points** — Drop a pin on a map and send it to a contact. The app notifies you when they arrive.

**Mesh routing** — Messages automatically relay through nearby devices to reach further nodes. The network is self-healing — no central hub, no single point of failure.

---

## How it works (the short version)

Every phone advertises itself over Bluetooth and scans for others doing the same. When two phones discover each other they connect and can exchange messages. When a message arrives that isn't addressed to you, you relay it forward — acting as a router for the people around you.

The network forms itself. No configuration required.

---

## Privacy

- Direct messages are encrypted end-to-end. Only the intended recipient can read them.
- Broadcast and topic messages are unencrypted by design — they're public by nature.
- No account registration. No phone number. No email. Your identity is a nickname and a cryptographic keypair generated on your device.
- Nothing ever leaves your device to a server. There are no servers.

---

## Built with

- React Native + Expo
- Bluetooth Low Energy (custom native peripheral module for iOS)
- [tweetnacl](https://github.com/dchest/tweetnacl-js) — NaCl box encryption (X25519 + XSalsa20-Poly1305)
- React Navigation

---

## Limitations

- **Range**: BLE covers roughly 10–30m per hop. The mesh extends this, but the denser the crowd, the better.
- **Background**: iOS throttles Bluetooth scanning when the app is in the background. Keep it open for best results.
- **No history**: Messages are stored in memory only and are lost when the app closes. There's no server to sync from.
- **Open topics**: Topic channels are public. Anyone who knows the name can join.

---

## Made at a hackathon

toot was built in a weekend as a proof of concept for infrastructure-free communication. It is not production software. Do not use it for anything where message delivery is critical.

That said — it works, and it's kind of magic when it does.
