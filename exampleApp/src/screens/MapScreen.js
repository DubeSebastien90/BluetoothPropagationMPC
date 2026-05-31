import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN);

const OFFLINE_PADDING = 0.05; // ~5km padding around markers
const OFFLINE_MIN_ZOOM = 10;
const OFFLINE_MAX_ZOOM = 16;

async function ensureOfflinePack(lat1, lng1, lat2, lng2) {
  const name = `mesh_${Math.round(lat1 * 10)}_${Math.round(lng1 * 10)}`;
  try {
    const packs = await MapboxGL.offlineManager.getPacks();
    if (packs.find(p => p.name === name)) return;

    const minLat = Math.min(lat1, lat2) - OFFLINE_PADDING;
    const maxLat = Math.max(lat1, lat2) + OFFLINE_PADDING;
    const minLng = Math.min(lng1, lng2) - OFFLINE_PADDING;
    const maxLng = Math.max(lng1, lng2) + OFFLINE_PADDING;

    await MapboxGL.offlineManager.createPack(
      {
        name,
        styleURL:  MapboxGL.StyleURL.Street,
        minZoom:   OFFLINE_MIN_ZOOM,
        maxZoom:   OFFLINE_MAX_ZOOM,
        bounds:    [[minLng, minLat], [maxLng, maxLat]],
      },
      (_, status) => console.log('[MAP] offline pack progress:', status?.percentage?.toFixed(0) + '%'),
      (_, err)    => console.warn('[MAP] offline pack error:', err),
    );
  } catch (e) {
    console.warn('[MAP] could not create offline pack:', e.message);
  }
}

export function MapScreen({ route }) {
  const { lat, lng }    = route.params;
  const [myLoc, setMyLoc] = useState(null);
  const [error, setError] = useState(null);
  const cameraRef         = useRef(null);

  useEffect(() => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      .then(({ coords }) => setMyLoc({ lat: coords.latitude, lng: coords.longitude }))
      .catch(() => setError('Could not get your location.'));
  }, []);

  useEffect(() => {
    if (!myLoc) return;
    ensureOfflinePack(lat, lng, myLoc.lat, myLoc.lng);
  }, [myLoc]);

  const bounds = myLoc ? {
    ne:            [Math.max(lng, myLoc.lng) + 0.008, Math.max(lat, myLoc.lat) + 0.008],
    sw:            [Math.min(lng, myLoc.lng) - 0.008, Math.min(lat, myLoc.lat) - 0.008],
    paddingTop:    80,
    paddingBottom: 80,
    paddingLeft:   80,
    paddingRight:  80,
  } : null;

  return (
    <View style={s.container}>
      <MapboxGL.MapView style={s.map} styleURL={MapboxGL.StyleURL.Street}>
        <MapboxGL.Camera
          ref={cameraRef}
          centerCoordinate={[lng, lat]}
          zoomLevel={13}
          animationDuration={500}
          {...(bounds ? { bounds } : {})}
        />

        {/* Shared location — red */}
        <MapboxGL.PointAnnotation id="shared" coordinate={[lng, lat]}>
          <View style={s.pinRed} />
          <MapboxGL.Callout title="Shared location" />
        </MapboxGL.PointAnnotation>

        {/* Current user — blue */}
        {myLoc && (
          <MapboxGL.PointAnnotation id="me" coordinate={[myLoc.lng, myLoc.lat]}>
            <View style={s.pinBlue} />
            <MapboxGL.Callout title="You" />
          </MapboxGL.PointAnnotation>
        )}
      </MapboxGL.MapView>

      {!myLoc && !error && (
        <View style={s.overlay}>
          <ActivityIndicator color="#2563eb" size="small" />
          <Text style={s.overlayText}>Getting your location...</Text>
        </View>
      )}

      {error && (
        <View style={s.overlay}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const PIN_SIZE = 18;

const s = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },
  pinRed: {
    width: PIN_SIZE, height: PIN_SIZE, borderRadius: PIN_SIZE / 2,
    backgroundColor: '#ef4444',
    borderWidth: 2, borderColor: '#fff',
  },
  pinBlue: {
    width: PIN_SIZE, height: PIN_SIZE, borderRadius: PIN_SIZE / 2,
    backgroundColor: '#2563eb',
    borderWidth: 2, borderColor: '#fff',
  },
  overlay: {
    position: 'absolute', bottom: 24, alignSelf: 'center',
    backgroundColor: '#0a0a1acc', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  overlayText: { color: '#fff', fontSize: 13 },
  errorText:   { color: '#ff5252', fontSize: 13 },
});
