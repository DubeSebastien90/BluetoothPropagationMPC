import React from 'react';
import {
  View, Text, SectionList, TouchableOpacity, StyleSheet, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';

const NO_ONE = require('../../assets/toot_no_one.png');

const ORB_TINTS = [
  'rgba(200, 50,  20, 0.38)',
  'rgba( 30, 150,  50, 0.38)',
  'rgba(130,  40, 220, 0.38)',
  'rgba(220, 130,   0, 0.38)',
  'rgba(  0, 160, 160, 0.38)',
  'rgba(  0, 100, 180, 0.38)',
  'rgba(180,   0, 100, 0.38)',
];
function orbColor(nickname) {
  return ORB_TINTS[(nickname.charCodeAt(0) || 0) % ORB_TINTS.length];
}

export function ContactsScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const peerCount = state.peers.length;

  const confirmDeleteContact = (contact) =>
    Alert.alert(
      'Remove contact',
      `Remove ${contact.nickname} from your contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: () => dispatch({ type: 'REMOVE_CONTACT', payload: contact.pubkey }),
        },
      ]
    );

  const confirmUnsubscribe = (topicName) =>
    Alert.alert(
      'Leave topic',
      `Unsubscribe from "#${topicName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive',
          onPress: () => dispatch({ type: 'UNSUBSCRIBE_TOPIC', payload: topicName }),
        },
      ]
    );

  const sections = [
    { key: 'topics',   title: 'Topics',   data: state.topics },
    { key: 'contacts', title: 'Contacts', data: state.contacts },
  ];
  const isEmpty = state.topics.length === 0 && state.contacts.length === 0;

  return (
    <View style={s.container}>
      <SafeAreaView edges={['top']} style={s.headerSafe}>
        <View style={s.header}>
          <Text style={s.headerTitle}>{state.identity?.nickname ?? 'toot'}</Text>
          <View style={s.peerPill}>
            <Text style={s.peerPillText}>
              {peerCount === 0 ? '📡' : `🔗 ${peerCount}`}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {isEmpty ? (
        <View style={s.emptyContainer}>
          <View style={s.emptyBox}>
            <Image source={NO_ONE} style={s.emptyImg} resizeMode="contain" />
            <Text style={s.emptyTitle}>Nothing here yet</Text>
            <Text style={s.emptyBody}>
              Scan a QR code to add a contact, or subscribe to a topic.
            </Text>
          </View>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => (typeof item === 'string' ? item : item.pubkey) ?? String(i)}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={s.listContent}
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{section.title}</Text>
              {section.key === 'topics' && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('SubscribeTopic')}
                  style={s.sectionActionBtn}
                  activeOpacity={0.75}
                >
                  <Text style={s.sectionActionText}>+ Subscribe</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          renderItem={({ item, section }) => {
            if (section.key === 'topics') {
              return (
                <TouchableOpacity
                  style={s.row}
                  onPress={() => navigation.navigate('TopicChat', { topicName: item })}
                  onLongPress={() => confirmUnsubscribe(item)}
                  activeOpacity={0.80}
                >
                  <View style={s.rowGloss} />
                  <View style={[s.orb, { backgroundColor: 'rgba(0,160,160,0.38)' }]}>
                    <Text style={s.orbText}>#</Text>
                    <View style={s.orbReflet} />
                  </View>
                  <View style={s.rowMid}>
                    <Text style={s.rowName}>{item}</Text>
                    <Text style={s.rowSub}>Topic channel</Text>
                  </View>
                  <Text style={s.rowChevron}>›</Text>
                </TouchableOpacity>
              );
            }

            const isOnline = state.peers.some(p => p.name === item.nickname);
            return (
              <TouchableOpacity
                style={s.row}
                onPress={() => navigation.navigate('Chat', { contact: item })}
                onLongPress={() => confirmDeleteContact(item)}
                activeOpacity={0.80}
              >
                <View style={s.rowGloss} />
                <View style={[s.orb, { backgroundColor: orbColor(item.nickname) }]}>
                  <Text style={s.orbText}>{item.nickname.slice(0, 1).toUpperCase()}</Text>
                  <View style={s.orbReflet} />
                  {isOnline && <View style={s.onlineDot} />}
                </View>
                <View style={s.rowMid}>
                  <Text style={s.rowName}>{item.nickname}</Text>
                  <Text style={s.rowSub} numberOfLines={1} ellipsizeMode="middle">
                    {item.pubkey}
                  </Text>
                </View>
                <Text style={s.rowChevron}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#004E92' },

  headerSafe: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(100,180,240,0.42)',
    shadowColor: '#003070', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  header: {
    height: 44, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, gap: 8,
  },
  headerTitle: { flex: 1, color: '#004E92', fontSize: 18, fontWeight: '900' },
  peerPill: {
    backgroundColor: 'rgba(0,78,146,0.10)', borderRadius: 9999,
    borderWidth: 1, borderColor: 'rgba(0,119,182,0.28)',
    paddingHorizontal: 10, paddingVertical: 3,
  },
  peerPillText: { color: '#0077B6', fontSize: 12, fontWeight: '700' },

  listContent: { paddingBottom: 16 },

  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyBox:  { alignItems: 'center', padding: 40, gap: 12 },
  emptyImg:  { width: 210, height: 180, opacity: 0.88 },
  emptyTitle:{ color: '#fff', fontSize: 20, fontWeight: '800' },
  emptyBody: { color: 'rgba(255,255,255,0.58)', fontSize: 14, textAlign: 'center', lineHeight: 21 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 18, paddingBottom: 5,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.3,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.42)',
  },
  sectionActionBtn: {
    backgroundColor: 'rgba(255,255,255,0.90)', borderRadius: 9999,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  sectionActionText: { fontSize: 11, fontWeight: '800', color: '#004E92' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8, gap: 8,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(100,180,230,0.20)',
    position: 'relative', overflow: 'hidden',
  },
  rowGloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '52%',
    backgroundColor: 'rgba(255,255,255,0.48)', pointerEvents: 'none',
  },
  orb: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.52)',
    overflow: 'hidden', flexShrink: 0,
  },
  orbText:   { color: '#fff', fontSize: 15, fontWeight: '800', zIndex: 1 },
  orbReflet: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '42%',
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 11, height: 11, borderRadius: 5.5,
    backgroundColor: '#38A169', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.93)',
  },
  rowMid:    { flex: 1, minWidth: 0 },
  rowName:   { color: '#003366', fontSize: 13, fontWeight: '800' },
  rowSub:    { color: '#4488AA', fontSize: 11, marginTop: 1 },
  rowChevron:{ color: '#88BBCC', fontSize: 18 },
});
