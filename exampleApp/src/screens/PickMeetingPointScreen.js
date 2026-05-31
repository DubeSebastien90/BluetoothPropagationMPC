import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { encodeMeetingPoint } from '../utils/locationMessage';
import { useApp } from '../state/AppContext';

export function PickMeetingPointScreen({ route, navigation }) {
  const { contact } = route.params;
  const { state, dispatch } = useApp();

  const [myLoc, setMyLoc]       = useState(null);
  const [meetPoint, setMeetPoint] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      .then(({ coords }) => {
        setMyLoc({ lat: coords.latitude, lng: coords.longitude });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleMapPress = (e) => {
    const [lng, lat] = e.geometry.coordinates;
    setMeetPoint({ lat, lng });
  };

  const confirm = () => {
    if (!meetPoint || !myLoc || !state.router) return;
    const body = encodeMeetingPoint(meetPoint.lat, meetPoint.lng, myLoc.lat, myLoc.lng);
    state.router.send(contact.nickname, contact.pubkey, body);
    dispatch({
      type: 'ADD_MESSAGE',
      payload: {
        id:     Date.now().toString(),
        from:   state.identity.nickname,
        fromId: state.identity.pubkey,
        to:     contact.nickname,
        toId:   contact.pubkey,
        body,
        ts:     Date.now(),
      },
    });
    navigation.goBack();
  };

  return (
    <View style={s.container}>
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#2563eb" size="large" />
          <Text style={s.loadingText}>Getting your location...</Text>
        </View>
      ) : (
        <>
          <MapboxGL.MapView style={s.map} onPress={handleMapPress} styleURL={MapboxGL.StyleURL.Street}>
            <MapboxGL.Camera
              centerCoordinate={myLoc ? [myLoc.lng, myLoc.lat] : [0, 0]}
              zoomLevel={14}
              animationDuration={300}
            />

            {/* Current user — blue dot */}
            {myLoc && (
              <MapboxGL.PointAnnotation id="me" coordinate={[myLoc.lng, myLoc.lat]}>
                <View style={s.pinBlue} />
              </MapboxGL.PointAnnotation>
            )}

            {/* Proposed meeting point — flag */}
            {meetPoint && (
              <MapboxGL.PointAnnotation id="meet" coordinate={[meetPoint.lng, meetPoint.lat]}>
                <Text style={s.flagIcon}>🏴</Text>
              </MapboxGL.PointAnnotation>
            )}
          </MapboxGL.MapView>

          <View style={s.hint}>
            <Text style={s.hintText}>
              {meetPoint ? '📍 Meeting point set — confirm or tap elsewhere to move it' : 'Tap on the map to set a meeting point'}
            </Text>
          </View>

          {meetPoint && (
            <TouchableOpacity style={s.confirmBtn} onPress={confirm}>
              <Text style={s.confirmText}>🏴 Send Meeting Point</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0a0a1a' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#555', fontSize: 14 },
  map:         { flex: 1 },
  pinBlue: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#2563eb', borderWidth: 2, borderColor: '#fff',
  },
  flagIcon: { fontSize: 28 },
  hint: {
    position: 'absolute', top: 16, alignSelf: 'center',
    backgroundColor: '#0a0a1acc', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  hintText:    { color: '#fff', fontSize: 13, textAlign: 'center' },
  confirmBtn: {
    position: 'absolute', bottom: 36, alignSelf: 'center',
    backgroundColor: '#2563eb', borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  confirmText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
