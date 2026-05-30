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
