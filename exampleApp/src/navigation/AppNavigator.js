import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ContactsScreen }   from '../screens/ContactsScreen';
import { ChatScreen }       from '../screens/ChatScreen';
import { ProfileScreen }    from '../screens/ProfileScreen';
import { ScanScreen }       from '../screens/ScanScreen';
import { BroadcastScreen }  from '../screens/BroadcastScreen';
import { useApp }           from '../state/AppContext';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle:      { backgroundColor: '#0a0a1a' },
  headerTintColor:  '#fff',
  headerTitleStyle: { fontWeight: '600' },
  contentStyle:     { backgroundColor: '#0a0a1a' },
};

export function AppNavigator() {
  const { state } = useApp();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen
          name="Contacts"
          component={ContactsScreen}
          options={({ navigation }) => ({
            title: state.identity?.nickname ?? 'Contacts',
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('Profile')}
                style={s.btn}
              >
                <Text style={s.btnText}>My QR</Text>
              </TouchableOpacity>
            ),
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('Scan')}
                style={s.btn}
              >
                <Text style={s.btnText}>Scan</Text>
              </TouchableOpacity>
            ),
          })}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={({ route }) => ({ title: route.params.contact.nickname })}
        />
        <Stack.Screen
          name="Broadcast"
          component={BroadcastScreen}
          options={{ title: '📡 Broadcast' }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'My Profile' }}
        />
        <Stack.Screen
          name="Scan"
          component={ScanScreen}
          options={{ title: 'Scan QR Code' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  btn:     { paddingHorizontal: 4 },
  btnText: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
});
