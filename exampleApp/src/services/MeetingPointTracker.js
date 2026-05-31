import * as Location from 'expo-location';

const TAG        = '[TRACKER]';
const INTERVAL   = 5000;   // ms
const THRESHOLD  = 50;     // metres

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R  = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class MeetingPointTracker {
  constructor({ getState, onArrived, onMessage }) {
    this.getState   = getState;
    this.onArrived  = onArrived;
    this.onMessage  = onMessage;
    this._timer     = null;
    this._running   = false;
    this._arrivedIds = new Set();
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._timer   = setInterval(() => this._check(), INTERVAL);
    console.log(TAG, 'started — checking every', INTERVAL / 1000, 's, threshold', THRESHOLD, 'm');
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer  = null;
    this._running = false;
    console.log(TAG, 'stopped');
  }

  async _check() {
    const { router, identity, meetingPoints } = this.getState();
    const active = meetingPoints.filter(mp => !mp.arrived);
    if (!active.length || !router || !identity) return;

    let coords;
    try {
      ({ coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }));
    } catch (e) {
      console.warn(TAG, 'location fetch failed:', e.message);
      return;
    }

    for (const mp of active) {
      if (this._arrivedIds.has(mp.id)) continue;
      const dist = distanceMeters(coords.latitude, coords.longitude, mp.meetLat, mp.meetLng);
      console.log(TAG, `distance to ${mp.contactNickname}'s meeting point: ${Math.round(dist)}m`);

      if (dist <= THRESHOLD) {
        this._arrivedIds.add(mp.id);
        console.log(TAG, `arrived at ${mp.contactNickname}'s meeting point — sending notification`);
        const message = `${identity.nickname} just arrived at your meeting point! 🎯`;
        const body    = JSON.stringify({ message });
        router.send(mp.contactNickname, mp.contactPubkey, body, 'arrival');
        this.onMessage({
          id:     Math.random().toString(36).slice(2, 8),
          from:   identity.nickname,
          fromId: identity.pubkey,
          to:     mp.contactNickname,
          toId:   mp.contactPubkey,
          body,
          type:   'arrival',
          ts:     Date.now(),
        });
        this.onArrived(mp.id);
      }
    }
  }
}
