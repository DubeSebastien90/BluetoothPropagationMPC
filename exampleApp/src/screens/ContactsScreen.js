import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';

const LOGO   = require('../../assets/toot_logo.png');
const NO_ONE = require('../../assets/toot_no_one.png');

const ORB_COLORS = [
  'rgba(200, 50,  20, 0.50)',
  'rgba( 30, 150,  50, 0.50)',
  'rgba(130,  40, 220, 0.50)',
  'rgba(220, 130,   0, 0.50)',
  'rgba(  0, 160, 160, 0.50)',
  'rgba(  0, 100, 180, 0.50)',
  'rgba(180,   0, 100, 0.50)',
];

function orbColor(nickname) {
  return ORB_COLORS[(nickname.charCodeAt(0) || 0) % ORB_COLORS.length];
}

export function ContactsScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const peerCount = state.peers.length;

  const confirmDelete = (contact) => {
    Alert.alert(
      'Remove contact',
      `Remove ${contact.nickname} from your contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => dispatch({ type: 'REMOVE_CONTACT', payload: contact.pubkey }),
        },
      ]
    );
  };

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={s.safeArea}>

        {/* ── Header ─────────────────────────────────────────── */}
        <View style={s.header}>
          <Image source={LOGO} style={s.logo} resizeMode="contain" />
          <Text style={s.headerTitle}>
            {state.identity?.nickname ?? 'toot'}
          </Text>
          <View style={s.statusPill}>
            <Text style={s.statusPillText}>
              {peerCount === 0
                ? '📡'
                : `🔗 ${peerCount} peer${peerCount > 1 ? 's' : ''}`}
            </Text>
          </View>
        </View>

        {/* ── Action buttons ─────────────────────────────────── */}
        <View style={s.actions}>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => navigation.navigate('Scan')}
            activeOpacity={0.75}
          >
            <Text style={s.actionBtnIcon}>📷</Text>
            <Text style={s.actionBtnText}>Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.75}
          >
            <Text style={s.actionBtnIcon}>🪪</Text>
            <Text style={s.actionBtnText}>My QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => navigation.navigate('Broadcast')}
            activeOpacity={0.75}
          >
            <Text style={s.actionBtnIcon}>📡</Text>
            <Text style={s.actionBtnText}>Broadcast</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>

      {/* ── Section label ──────────────────────────────────────── */}
      {state.contacts.length > 0 && (
        <Text style={s.sectionLabel}>contacts</Text>
      )}

      {/* ── Contact list ───────────────────────────────────────── */}
      <FlatList
        data={state.contacts}
        keyExtractor={c => c.pubkey}
        contentContainerStyle={
          state.contacts.length === 0 ? s.emptyContainer : s.listContent
        }
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Image source={NO_ONE} style={s.emptyImg} resizeMode="contain" />
            <Text style={s.emptyTitle}>No contacts yet</Text>
            <Text style={s.emptyBody}>
              Tap Scan to scan someone's QR code and add them as a contact.
            </Text>
            <TouchableOpacity
              style={s.scanBtn}
              onPress={() => navigation.navigate('Scan')}
              activeOpacity={0.75}
            >
              <Text style={s.scanBtnText}>📷  Scan QR Code</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.row}
            onPress={() => navigation.navigate('Chat', { contact: item })}
            onLongPress={() => confirmDelete(item)}
            activeOpacity={0.7}
          >
            {/* Orb avatar */}
            <View style={[s.orb, { backgroundColor: orbColor(item.nickname) }]}>
              <Text style={s.orbText}>
                {item.nickname.slice(0, 1).toUpperCase()}
              </Text>
              {/* Top-gloss reflet */}
              <View style={s.orbReflet} />
            </View>

            {/* Name + key */}
            <View style={s.rowText}>
              <Text style={s.name}>{item.nickname}</Text>
              <Text style={s.pubkey} numberOfLines={1} ellipsizeMode="middle">
                {item.pubkey}
              </Text>
            </View>

            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

/* ─────────────────────────────── Styles ─────────────────────────────────── */

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#004E92',
  },

  /* Safe-area top (glass header zone) */
  safeArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#001F50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  /* Header row */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 10,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  statusPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.38)',
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  statusPillText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Action pill buttons row */
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 14,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    paddingVertical: 9,
    shadowColor: '#001F50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20,
    shadowRadius: 5,
    elevation: 3,
  },
  actionBtnIcon: { fontSize: 15 },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  /* Section label above list */
  sectionLabel: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.48)',
  },

  listContent: {
    paddingBottom: 24,
  },

  /* Empty state */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyImg: {
    width: 220,
    height: 190,
    marginBottom: 4,
    opacity: 0.92,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  emptyBody: {
    color: 'rgba(255, 255, 255, 0.60)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  scanBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.48)',
    paddingHorizontal: 28,
    paddingVertical: 12,
    shadowColor: '#001F50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.20,
    shadowRadius: 6,
    elevation: 3,
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  /* Contact row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 12,
    marginBottom: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    gap: 12,
    shadowColor: '#001F50',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 2,
  },

  /* Orb avatar */
  orb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    zIndex: 1,
  },
  orbReflet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },

  rowText: { flex: 1 },
  name: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pubkey: {
    color: 'rgba(255, 255, 255, 0.40)',
    fontSize: 11,
    marginTop: 2,
  },
  chevron: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 24,
    fontWeight: '300',
  },
});
