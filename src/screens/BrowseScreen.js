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
import { Ionicons } from '@expo/vector-icons';
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
import { colors, radius, shadow, space } from '../theme';

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
  const filtering = category !== 'All' || search !== '';

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

  function clearFilters() {
    setQuery('');
    setCategory('All');
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
      // Row-level security rejects the claim when the member is blocked for no-shows.
      const blocked = /row-level security/i.test(err.message);
      Alert.alert(
        'Could not claim',
        blocked
          ? 'You can’t claim items right now because of missed collections. Get in touch if you think this is wrong.'
          : err.message
      );
      return;
    }
    if (!data || data.length === 0) {
      Alert.alert('Already gone', 'Someone else claimed this item first.');
      refresh();
      return;
    }
    Alert.alert(
      'Claimed',
      'Collect within 48 hours, or the claim expires and counts as a missed collection. Find it under Activity.'
    );
    refresh();
  }

  function confirmClaim(item) {
    Alert.alert(
      'Claim this item?',
      `"${item.title}". Collect within 48 hours. Arrange pickup and any payment with ${item.lister?.display_name || 'the lister'}. Offcut does not handle payments.`,
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

  function renderCard({ item }) {
    const photo = photoUrl(item.photo_path);
    const mine = item.lister_id === userId;
    const free = Number(item.price) === 0;
    const lister = item.lister?.display_name || 'a member';

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Text style={styles.emoji}>{EMOJI[item.category] || '📦'}</Text>
            </View>
          )}

          <View style={styles.cardBody}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={[styles.pricePill, free && styles.pricePillFree]}>
                <Text style={[styles.priceText, free && styles.priceTextFree]}>{priceLabel(item.price)}</Text>
              </View>
            </View>

            <View style={styles.tagRow}>
              <Text style={styles.tag}>{item.category}</Text>
              <Text style={styles.tag}>{item.condition}</Text>
            </View>

            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={colors.muted} />
              <Text style={styles.meta}>{item.area}</Text>
            </View>
          </View>
        </View>

        {item.notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            {item.notes}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.lister}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{lister.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              {mine ? 'Your listing' : lister}
            </Text>
          </View>
        </View>

        {!mine ? (
          <View style={styles.actions}>
            <Pressable style={styles.claimBtn} onPress={() => confirmClaim(item)}>
              <Ionicons name="hand-left-outline" size={16} color={colors.card} />
              <Text style={styles.claimText}>{free ? 'Claim for free' : `Claim for ${priceLabel(item.price)}`}</Text>
            </Pressable>
            <Pressable
              style={styles.reportBtn}
              onPress={() => setReportingId(item.id)}
              accessibilityLabel="Report this listing"
            >
              <Ionicons name="flag-outline" size={18} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.muted} style={{ marginRight: space.sm }} />
        <TextInput
          style={styles.search}
          placeholder="Search oak, tiles, copper…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={styles.chipsContent}>
        {['All', ...CATEGORIES].map((c) => {
          const on = category === c;
          return (
            <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sortRow}>
        <Text style={styles.count}>
          {items.length} {items.length === 1 ? 'listing' : 'listings'}
        </Text>
        <View style={styles.sortGroup}>
          {SORTS.map((s) => {
            const on = sortKey === s.key;
            return (
              <Pressable key={s.key} onPress={() => setSortKey(s.key)} style={styles.sortBtn}>
                <Text style={[styles.sortText, on && styles.sortOn]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        refreshControl={
          <RefreshControl refreshing={loading && items.length === 0} onRefresh={refresh} tintColor={colors.accent} />
        }
        contentContainerStyle={styles.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={colors.line} />
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyText}>
                {filtering
                  ? 'No listings match that search. Try a different word or category.'
                  : 'No spare materials listed nearby yet. Be the first to post one.'}
              </Text>
              {filtering ? (
                <Pressable style={styles.emptyBtn} onPress={clearFilters}>
                  <Text style={styles.emptyBtnText}>Clear filters</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        ListFooterComponent={loading && items.length > 0 ? <ActivityIndicator style={{ margin: space.lg }} color={colors.accent} /> : null}
        renderItem={renderCard}
      />

      <Modal visible={reportingId !== null} transparent animationType="fade" onRequestClose={() => setReportingId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setReportingId(null)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Why are you reporting this?</Text>
            {REPORT_REASONS.map((r) => (
              <Pressable key={r} style={styles.sheetRow} onPress={() => report(r)}>
                <Text style={styles.sheetText}>{r}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.sheetRow} onPress={() => setReportingId(null)}>
              <Text style={[styles.sheetText, { color: colors.muted }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.lg,
    marginTop: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  search: { flex: 1, paddingVertical: 11, fontSize: 16, color: colors.text },
  chipsRow: { flexGrow: 0, marginTop: space.md },
  chipsContent: { paddingHorizontal: space.lg, gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextOn: { color: colors.card, fontWeight: '600' },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  count: { fontSize: 13, color: colors.muted },
  sortGroup: { flexDirection: 'row', gap: space.sm },
  sortBtn: { paddingVertical: 2 },
  sortText: { color: colors.muted, fontSize: 13 },
  sortOn: { color: colors.accent, fontWeight: '600' },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    marginBottom: space.md,
    ...shadow,
  },
  cardTop: { flexDirection: 'row', gap: space.md },
  photo: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.line },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  emoji: { fontSize: 34 },
  cardBody: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  pricePill: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  pricePillFree: { backgroundColor: '#e7f6ec' },
  priceText: { fontSize: 13, fontWeight: '700', color: colors.accent },
  priceTextFree: { color: colors.ok },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    fontSize: 12,
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { fontSize: 13, color: colors.muted },
  notes: { fontSize: 13, color: colors.muted, marginTop: space.sm, lineHeight: 18 },
  footer: { marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  lister: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  claimBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 11,
  },
  claimText: { color: colors.card, fontWeight: '600', fontSize: 15 },
  reportBtn: {
    width: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingTop: space.xl * 2, paddingHorizontal: space.xl, gap: space.sm },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginTop: space.sm },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: space.md,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 9,
  },
  emptyBtnText: { color: colors.accent, fontWeight: '600' },
  error: { color: colors.danger, paddingHorizontal: space.lg, marginBottom: space.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.sm,
    paddingBottom: space.xl,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginVertical: space.sm },
  sheetTitle: { fontSize: 15, fontWeight: '600', color: colors.text, padding: space.md },
  sheetRow: { padding: space.md, borderTopWidth: 1, borderTopColor: colors.line },
  sheetText: { fontSize: 16, color: colors.text },
});
