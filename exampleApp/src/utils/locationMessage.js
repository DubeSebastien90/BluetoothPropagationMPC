export function encodeLocation(lat, lng) {
  return JSON.stringify({
    type: 'location',
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
