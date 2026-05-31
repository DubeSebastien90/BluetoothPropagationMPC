export function encodeLocation(lat, lng) {
  return JSON.stringify({
    lat: Math.round(lat * 1e6),
    lng: Math.round(lng * 1e6),
  });
}

export function decodeLocation(body) {
  try {
    const parsed = JSON.parse(body);
    if (parsed?.type === 'location' && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
      return { type: 'location', lat: parsed.lat / 1e6, lng: parsed.lng / 1e6 };
    }
  } catch {}
  return null;
}

export function encodeMeetingPoint(meetLat, meetLng, fromLat, fromLng) {
  return JSON.stringify({
    meetLat: Math.round(meetLat * 1e6),
    meetLng: Math.round(meetLng * 1e6),
    fromLat: Math.round(fromLat * 1e6),
    fromLng: Math.round(fromLng * 1e6),
  });
}

export function decodeMeetingPoint(body) {
  try {
    const p = JSON.parse(body);
    if (
      p?.type === 'meetingpoint' &&
      typeof p.meetLat === 'number' && typeof p.meetLng === 'number' &&
      typeof p.fromLat === 'number' && typeof p.fromLng === 'number'
    ) {
      return {
        type:    'meetingpoint',
        meetLat: p.meetLat / 1e6,
        meetLng: p.meetLng / 1e6,
        fromLat: p.fromLat / 1e6,
        fromLng: p.fromLng / 1e6,
      };
    }
  } catch {}
  return null;
}
