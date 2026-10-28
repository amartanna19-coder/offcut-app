import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './src/supabase';
import AuthScreen from './src/screens/AuthScreen';
import BrowseScreen from './src/screens/BrowseScreen';
import ListScreen from './src/screens/ListScreen';
import MineScreen from './src/screens/MineScreen';

const TABS = [
  { key: 'browse', label: 'Browse' },
  { key: 'list', label: 'List item' },
  { key: 'mine', label: 'My activity' },
];

export default function App() {
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="auto" />
        <AuthScreen />
      </SafeAreaView>
    );
  }

  const userId = session.user.id;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.title}>Offcut</Text>
        <Text style={styles.subtitle}>Spare building materials, Ruislip</Text>
      </View>

      <View style={styles.main}>
        {tab === 'browse' && <BrowseScreen userId={userId} />}
        {tab === 'list' && <ListScreen userId={userId} onPosted={() => setTab('browse')} />}
        {tab === 'mine' && <MineScreen userId={userId} />}
      </View>

      <View style={styles.nav}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={styles.navBtn} onPress={() => setTab(t.key)}>
            <Text style={[styles.navText, tab === t.key && styles.navActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f5f2' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f5f2' },
  header: { padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e4e2dc' },
  title: { fontSize: 20, fontWeight: '700', color: '#1d1d1b' },
  subtitle: { fontSize: 13, color: '#6b6a66' },
  main: { flex: 1 },
  nav: { flexDirection: 'row', backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e4e2dc' },
  navBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  navText: { color: '#6b6a66', fontSize: 14 },
  navActive: { color: '#c2410c', fontWeight: '600' },
});
