import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

export function MapScreen({ route }) {
  const { lat, lng } = route.params;
  const [myLocation, setMyLocation] = useState(null);
  const [error, setError]           = useState(null);
  const mapRef                      = useRef(null);

  useEffect(() => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      .then(({ coords }) => setMyLocation({ lat: coords.latitude, lng: coords.longitude }))
      .catch(() => setError('Could not get your location.'));
  }, []);

  useEffect(() => {
    if (!myLocation || !mapRef.current) return;
    mapRef.current.fitToCoordinates(
      [
        { latitude: lat,            longitude: lng },
        { latitude: myLocation.lat, longitude: myLocation.lng },
      ],
      { edgePadding: { top: 80, right: 80, bottom: 80, left: 80 }, animated: true }
    );
  }, [myLocation]);

  return (
    <View style={s.container}>
      <MapView ref={mapRef} style={s.map} initialRegion={{
        latitude:       lat,
        longitude:      lng,
        latitudeDelta:  0.02,
        longitudeDelta: 0.02,
      }}>
        <Marker
          coordinate={{ latitude: lat, longitude: lng }}
          title="Shared location"
          pinColor="red"
        />
        {myLocation && (
          <Marker
            coordinate={{ latitude: myLocation.lat, longitude: myLocation.lng }}
            title="You"
            pinColor="#2563eb"
          />
        )}
      </MapView>

      {!myLocation && !error && (
        <View style={s.overlay}>
          <ActivityIndicator color="#2563eb" />
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

const s = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },
  overlay: {
    position: 'absolute', bottom: 24, alignSelf: 'center',
    backgroundColor: '#0a0a1acc', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  overlayText: { color: '#fff', fontSize: 13 },
  errorText:   { color: '#ff5252', fontSize: 13 },
});
