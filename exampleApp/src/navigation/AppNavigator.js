import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabScreen }          from '../screens/MainTabScreen';
import { ChatScreen }             from '../screens/ChatScreen';
import { MapScreen }              from '../screens/MapScreen';
import { PickMeetingPointScreen } from '../screens/PickMeetingPointScreen';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: 'rgba(255,255,255,0.92)' },
  headerTintColor:  '#004E92',
  headerTitleStyle: { fontWeight: '800', fontSize: 17, color: '#004E92' },
  headerShadowVisible: true,
  contentStyle: { backgroundColor: '#004E92' },
};

export function AppNavigator({ onDeleteAccount }) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {/* Main shell — owns its own header & tab bar */}
        <Stack.Screen name="Main" options={{ headerShown: false }}>
          {(props) => <MainTabScreen {...props} onDeleteAccount={onDeleteAccount} />}
        </Stack.Screen>

        {/* Stack screens pushed from within tabs */}
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={({ route }) => ({ title: route.params.contact.nickname })}
        />
        <Stack.Screen
          name="Map"
          component={MapScreen}
          options={{ title: '📍 Location' }}
        />
        <Stack.Screen
          name="PickMeetingPoint"
          component={PickMeetingPointScreen}
          options={{ title: '🏴 Set Meeting Point' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
