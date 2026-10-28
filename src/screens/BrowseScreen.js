import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../supabase';
import {
  CATEGORIES,
  EMOJI,
  PAGE_SIZE,
  REPORT_REASONS,
  SORTS,
  photoUrl,
  priceLabel,
} from '../constants';

export default function BrowseScreen({ userId }) {
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState('All');
  const [sortKey, setSortKey] = useState('newest');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [reportingId, setReportingId] = useState(null);
  const pageRef = useRef(0);
  const requestRef = useRef(0);

  const sort = SORTS.find((s) => s.key === sortKey);

  // Debounce typing so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    async (page, reset) => {
      const req = ++requestRef.current;
      setLoading(true);

      let q = supabase
        .from('listings')
        .select('*, lister:profiles!lister_id(display_name)')
        .eq('status', 'available')
        .order(sort.column, { ascending: sort.ascending })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (category !== 'All') q = q.eq('category', category);
      if (search) q = q.ilike('title', `%${search.replace(/[%_,]/g, '')}%`);

      const { data, error: err } = await q;
      if (req !== requestRef.current) return; // a newer request has replaced this one

      setLoading(false);
      if (err) {
        setError(err.message);
        return;
      }
      setError(null);
      setHasMore(data.length === PAGE_SIZE);
      setItems((prev) => (reset ? data : [...prev, ...data]));
      pageRef.current = page;
    },
    [category, search, sort]
  );

  // Reload from the first page whenever filters or sort change.
  useEffect(() => {
    fetchPage(0, true);
  }, [fetchPage]);

  function refresh() {
    fetchPage(0, true);
  }

  function loadMore() {
    if (!loading && hasMore) fetchPage(pageRef.current + 1, false);
  }

  async function claim(item) {
    // Only succeeds if the listing is still available and the user isn't the lister.
    // Row-level security enforces the same rules on the server.
    const { data, error: err } = await supabase
      .from('listings')
      .update({ status: 'claimed', claimed_by: userId })
      .eq('id', item.id)
      .eq('status', 'available')
      .neq('lister_id', userId)
      .select();

    if (err) {
      Alert.alert('Could not claim', err.message);
      return;
    }
    if (!data || data.length === 0) {
      Alert.alert('Already gone', 'Someone else claimed this item first.');
      refresh();
      return;
    }
    Alert.alert('Claimed', 'Find it under My activity for pickup details and to cancel if needed.');
    refresh();
  }

  function confirmClaim(item) {
    Alert.alert(
      'Claim this item?',
      `"${item.title}". You'll arrange pickup and payment with ${item.lister?.display_name || 'the lister'}. Offcut does not handle payments.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Claim', onPress: () => claim(item) },
      ]
    );
  }

  async function report(reason) {
    const listingId = reportingId;
    setReportingId(null);
    const { error: err } = await supabase
      .from('reports')
      .insert({ listing_id: listingId, reporter_id: userId, reason });
    if (err) {
      Alert.alert(
        'Could not send report',
        err.code === '23505' ? 'You have already reported this listing.' : err.message
      );
    } else {
      Alert.alert('Thanks', 'We review reports and may remove listings that break the rules.');
    }
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.search}
        placeholder="Search, e.g. oak, tiles, copper"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
        {['All', ...CATEGORIES].map((c) => (
          <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipOn]}>
            <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.sortRow}>
        {SORTS.map((s) => (
          <Pressable key={s.key} onPress={() => setSortKey(s.key)}>
            <Text style={[styles.sortText, sortKey === s.key && styles.sortOn]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        refreshControl={<RefreshControl refreshing={loading && items.length === 0} onRefresh={refresh} />}
        contentContainerStyle={styles.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          loading ? null : <Text style={styles.empty}>No matching listings nearby. Try another search or category.</Text>
        }
        ListFooterComponent={loading && items.length > 0 ? <ActivityIndicator style={{ margin: 16 }} /> : null}
        renderItem={({ item }) => {
          const photo = photoUrl(item.photo_path);
          const mine = item.lister_id === userId;
          return (
            <View style={styles.card}>
              <View style={styles.row}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photo} />
                ) : (
                  <View style={styles.thumb}>
                    <Text style={styles.emoji}>{EMOJI[item.category] || '📦'}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.meta}>
                    {item.area} · {item.condition}
                  </Text>
                  <Text style={styles.meta}>Listed by {item.lister?.display_name || 'a member'}</Text>
                  <Text style={styles.price}>{priceLabel(item.price)}</Text>
                </View>
              </View>
              {item.notes ? <Text style={styles.meta}>{item.notes}</Text> : null}

              {mine ? (
                <Text style={styles.meta}>Your listing</Text>
              ) : (
                <View style={styles.actions}>
                  <Pressable style={[styles.claimBtn, { flex: 1 }]} onPress={() => confirmClaim(item)}>
                    <Text style={styles.claimText}>
                      {Number(item.price) === 0 ? 'Claim for free' : `Claim for ${priceLabel(item.price)}`}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.reportBtn} onPress={() => setReportingId(item.id)}>
                    <Text style={styles.reportText}>Report</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />

      <Modal visible={reportingId !== null} transparent animationType="fade" onRequestClose={() => setReportingId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setReportingId(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Why are you reporting this?</Text>
            {REPORT_REASONS.map((r) => (
              <Pressable key={r} style={styles.sheetRow} onPress={() => report(r)}>
                <Text style={styles.sheetText}>{r}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.sheetRow} onPress={() => setReportingId(null)}>
              <Text style={[styles.sheetText, { color: '#6b6a66' }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  search: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e4e2dc',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
  },
  chipsRow: { paddingHorizontal: 16, paddingVertical: 10, flexGrow: 0 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e4e2dc',
    backgroundColor: '#ffffff',
    marginRight: 8,
  },
  chipOn: { backgroundColor: '#c2410c', borderColor: '#c2410c' },
  chipText: { color: '#1d1d1b', fontSize: 14 },
  chipTextOn: { color: '#ffffff' },
  sortRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, marginBottom: 6 },
  sortText: { color: '#6b6a66', fontSize: 13 },
  sortOn: { color: '#c2410c', fontWeight: '600' },
  list: { padding: 16, paddingTop: 4 },
  card: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e4e2dc', padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  photo: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#e4e2dc' },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#e4e2dc', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1d1d1b' },
  meta: { fontSize: 13, color: '#6b6a66', marginTop: 2 },
  price: { fontSize: 15, fontWeight: '700', color: '#1d1d1b', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  claimBtn: { backgroundColor: '#c2410c', borderRadius: 10, padding: 12, alignItems: 'center' },
  claimText: { color: '#ffffff', fontWeight: '600' },
  reportBtn: { borderWidth: 1, borderColor: '#e4e2dc', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  reportText: { color: '#6b6a66' },
  empty: { textAlign: 'center', color: '#6b6a66', marginTop: 32, paddingHorizontal: 24 },
  error: { color: '#b91c1c', paddingHorizontal: 16, marginBottom: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 8, paddingBottom: 24 },
  sheetTitle: { fontSize: 15, fontWeight: '600', color: '#1d1d1b', padding: 12 },
  sheetRow: { padding: 14, borderTopWidth: 1, borderTopColor: '#f0efeb' },
  sheetText: { fontSize: 16, color: '#1d1d1b' },
});
