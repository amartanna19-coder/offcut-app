import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from './src/supabase';
import { colors, radius, space } from './src/theme';
import AuthScreen from './src/screens/AuthScreen';
import BrowseScreen from './src/screens/BrowseScreen';
import ListScreen from './src/screens/ListScreen';
import MineScreen from './src/screens/MineScreen';

const TABS = [
  { key: 'browse', label: 'Browse', icon: 'search-outline', activeIcon: 'search' },
  { key: 'list', label: 'List item', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  { key: 'mine', label: 'Activity', icon: 'person-outline', activeIcon: 'person' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('browse');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Keep content clear of the status bar at the top and the gesture bar at the bottom.
  const screenStyle = [styles.safe, { paddingTop: insets.top }];

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={screenStyle}>
        <StatusBar style="dark" />
        <AuthScreen />
      </View>
    );
  }

  const userId = session.user.id;

  return (
    <View style={screenStyle}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image source={require('./assets/icon.png')} style={styles.logo} />
          <View>
            <Text style={styles.title}>Offcut</Text>
            <Text style={styles.subtitle}>Spare building materials, Ruislip</Text>
          </View>
        </View>
      </View>

      <View style={styles.main}>
        {tab === 'browse' && <BrowseScreen userId={userId} />}
        {tab === 'list' && <ListScreen userId={userId} onPosted={() => setTab('browse')} />}
        {tab === 'mine' && <MineScreen userId={userId} />}
      </View>

      <View style={[styles.nav, { paddingBottom: insets.bottom + space.xs }]}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} style={styles.navBtn} onPress={() => setTab(t.key)} accessibilityRole="tab">
              <View style={[styles.navPill, active && styles.navPillOn]}>
                <Ionicons
                  name={active ? t.activeIcon : t.icon}
                  size={22}
                  color={active ? colors.accent : colors.muted}
                />
              </View>
              <Text style={[styles.navText, active && styles.navActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logo: { width: 34, height: 34, borderRadius: radius.sm },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.muted },
  main: { flex: 1 },
  nav: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  navBtn: { flex: 1, alignItems: 'center', paddingTop: space.sm },
  navPill: {
    width: 56,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navPillOn: { backgroundColor: colors.accentSoft },
  navText: { color: colors.muted, fontSize: 12, marginTop: 2 },
  navActive: { color: colors.accent, fontWeight: '600' },
});
