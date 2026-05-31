export function encodeLocation(lat, lng) {
  return JSON.stringify({ type: 'location', lat, lng });
}

export function decodeLocation(body) {
  try {
    const parsed = JSON.parse(body);
    if (parsed?.type === 'location' && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
      return parsed;
    }
  } catch {}
  return null;
}
