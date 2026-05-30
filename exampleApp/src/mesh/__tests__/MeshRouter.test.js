import { MeshRouter } from '../MeshRouter';
import { MockTransport } from '../../mocks/MockTransport';
import { NullCrypto } from '../../mocks/NullCrypto';
import { createPacket } from '../../contracts/Packet';

const BOB_IDENTITY   = { nickname: 'bob',   pubkey: 'bob-pubkey-base64=='   };
const ALICE_IDENTITY = { nickname: 'alice', pubkey: 'alice-pubkey-base64==' };
const CHARLIE_IDENTITY = { nickname: 'charlie', pubkey: 'charlie-pubkey-base64==' };

function makeSetup(onMessageForMe = () => {}) {
  const transport = new MockTransport({
    onPacketReceived:   () => {},
    onPeerConnected:    () => {},
    onPeerDisconnected: () => {},
  });
  const router = new MeshRouter(BOB_IDENTITY, transport, new NullCrypto(), onMessageForMe);
  router.start();
  return { transport, router };
}

// B1 — Message addressed to me is delivered
test('B1: message for me is delivered', () => {
  const received = [];
  const { transport } = makeSetup((msg) => received.push(msg));

  transport.simulateIncoming(
    ALICE_IDENTITY.nickname,
    BOB_IDENTITY.nickname,
    'hello bob',
    ALICE_IDENTITY.pubkey,
    BOB_IDENTITY.pubkey,   // toId matches bob's pubkey
  );

  expect(received).toHaveLength(1);
  expect(received[0].body).toBe('hello bob');
  expect(received[0].from).toBe('alice');
});

// B2 — Message not for me is relayed but not delivered
test('B2: message not for me is relayed, not delivered', () => {
  const received = [];
  const { transport } = makeSetup((msg) => received.push(msg));

  transport.simulateIncoming(
    ALICE_IDENTITY.nickname,
    CHARLIE_IDENTITY.nickname,
    'hello charlie',
    ALICE_IDENTITY.pubkey,
    CHARLIE_IDENTITY.pubkey,  // toId does NOT match bob's pubkey
  );

  expect(received).toHaveLength(0);       // not delivered to bob
  expect(transport.sent).toHaveLength(1); // relayed
});

// B3 — Duplicate packet is dropped
test('B3: duplicate packet is dropped', () => {
  const { transport } = makeSetup();

  const packet = createPacket({
    from:   ALICE_IDENTITY.nickname,
    fromId: ALICE_IDENTITY.pubkey,
    to:     CHARLIE_IDENTITY.nickname,
    toId:   CHARLIE_IDENTITY.pubkey,
    body:   'hello',
  });

  transport.onPacketReceived(packet, 'device-1');
  transport.onPacketReceived(packet, 'device-1'); // same packet again

  expect(transport.sent).toHaveLength(1); // relayed once, not twice
});

// B4 — TTL=1 packet is not relayed
test('B4: TTL=1 packet is not relayed', () => {
  const { transport } = makeSetup();

  const packet = createPacket({
    from:   ALICE_IDENTITY.nickname,
    fromId: ALICE_IDENTITY.pubkey,
    to:     CHARLIE_IDENTITY.nickname,
    toId:   CHARLIE_IDENTITY.pubkey,
    body:   'hello',
  });
  packet.ttl = 1;

  transport.onPacketReceived(packet, 'device-1');

  expect(transport.sent).toHaveLength(0); // dropped, not relayed
});

// B5 — Broadcast is delivered to me AND relayed
test('B5: broadcast is delivered and relayed', () => {
  const received = [];
  const { transport } = makeSetup((msg) => received.push(msg));

  transport.simulateIncoming(
    ALICE_IDENTITY.nickname,
    'all',
    'everyone hear me',
    ALICE_IDENTITY.pubkey,
    'all',
  );

  expect(received).toHaveLength(1);       // delivered to bob
  expect(transport.sent).toHaveLength(1); // also relayed
});
