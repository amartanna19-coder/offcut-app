import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { AREAS, ROLES, priceLabel } from '../constants';
import { colors, radius, shadow, space } from '../theme';

function formatDeadline(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Chooser({ label, options, value, onChange }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((o) => {
          const on = value === o;
          return (
            <Pressable key={o} onPress={() => onChange(o)} style={[styles.opt, on && styles.optOn]}>
              <Text style={[styles.optText, on && styles.optTextOn]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// A small coloured pill for listing and claim status.
function Status({ tone, children }) {
  const palette = STATUS_TONES[tone];
  return (
    <View style={[styles.status, { backgroundColor: palette.bg }]}>
      <Text style={[styles.statusText, { color: palette.fg }]}>{children}</Text>
    </View>
  );
}

const STATUS_TONES = {
  live: { bg: colors.accentSoft, fg: colors.accent },
  claimed: { bg: '#fef3c7', fg: '#b45309' },
  done: { bg: '#e7f6ec', fg: colors.ok },
  muted: { bg: colors.line, fg: colors.muted },
};

function ProfileCard({ userId }) {
  const [profile, setProfile] = useState({ display_name: '', role: ROLES[1], trade: '', area: AREAS[0], completed_count: 0 });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('display_name, role, trade, area, completed_count')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setProfile({ ...data, area: data.area || AREAS[0], trade: data.trade || '' });
      });
  }, [userId]);

  async function save() {
    const name = profile.display_name.trim();
    if (!name) {
      Alert.alert('Add a name', 'Other members see this name, not your email.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: name,
        role: profile.role,
        trade: profile.role === 'Tradesperson' ? profile.trade.trim() || null : null,
        area: profile.area,
      })
      .eq('id', userId);
    setSaving(false);
    if (error) Alert.alert('Could not save', error.message);
    else {
      Alert.alert('Saved', 'Your profile is updated.');
      setOpen(false);
    }
  }

  if (!open) {
    const initial = (profile.display_name || '?').charAt(0).toUpperCase();
    return (
      <View style={styles.card}>
        <View style={styles.profileTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{profile.display_name || 'Your profile'}</Text>
            <Text style={styles.meta}>
              {profile.role}
              {profile.trade ? ` · ${profile.trade}` : ''} · {profile.area}
            </Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <Ionicons name="checkmark-done-outline" size={16} color={colors.ok} />
          <Text style={styles.meta}>
            {profile.completed_count} completed {profile.completed_count === 1 ? 'collection' : 'collections'}
          </Text>
        </View>
        <Pressable style={styles.ghostBtn} onPress={() => setOpen(true)}>
          <Ionicons name="create-outline" size={16} color={colors.text} />
          <Text style={styles.ghostBtnText}>Edit profile</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Edit profile</Text>
      <Text style={styles.label}>Display name (shown to others)</Text>
      <TextInput
        style={styles.input}
        value={profile.display_name}
        onChangeText={(v) => setProfile({ ...profile, display_name: v })}
        maxLength={40}
        placeholder="e.g. Dave (Joiner)"
        placeholderTextColor={colors.muted}
      />
      <Chooser label="I am a" options={ROLES} value={profile.role} onChange={(v) => setProfile({ ...profile, role: v })} />
      {profile.role === 'Tradesperson' ? (
        <>
          <Text style={styles.label}>Trade</Text>
          <TextInput
            style={styles.input}
            value={profile.trade}
            onChangeText={(v) => setProfile({ ...profile, trade: v })}
            maxLength={40}
            placeholder="e.g. Plumber, joiner, tiler"
            placeholderTextColor={colors.muted}
          />
        </>
      ) : null}
      <Chooser label="Area" options={AREAS} value={profile.area} onChange={(v) => setProfile({ ...profile, area: v })} />
      <View style={styles.btnRow}>
        <Pressable style={styles.ghostBtn} onPress={() => setOpen(false)}>
          <Text style={styles.ghostBtnText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.primaryBtn, saving && styles.disabled]} onPress={save} disabled={saving}>
          <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save profile'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MineScreen({ userId }) {
  const [claims, setClaims] = useState([]);
  const [listings, setListings] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const [c, l] = await Promise.all([
      supabase
        .from('listings')
        .select('*, lister:profiles!lister_id(display_name)')
        .eq('claimed_by', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('listings')
        .select('*, claimer:profiles!claimed_by(display_name)')
        .eq('lister_id', userId)
        .neq('status', 'removed')
        .order('created_at', { ascending: false }),
    ]);
    if (c.error || l.error) setError((c.error || l.error).message);
    else {
      setError(null);
      setClaims(c.data);
      setListings(l.data);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  function cancelClaim(item) {
    Alert.alert('Cancel this claim?', `"${item.title}" goes back to Browse for others to claim.`, [
      { text: 'Keep claim', style: 'cancel' },
      {
        text: 'Cancel claim',
        style: 'destructive',
        onPress: async () => {
          const { error: err } = await supabase
            .from('listings')
            .update({ status: 'available', claimed_by: null })
            .eq('id', item.id)
            .eq('claimed_by', userId);
          if (err) Alert.alert('Could not cancel', err.message);
          else load();
        },
      },
    ]);
  }

  // Lister confirms the outcome. Both actions go through database functions that update counts.
  async function recordOutcome(item, fn, title, message) {
    Alert.alert(title, message, [
      { text: 'Back', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          const { error: err } = await supabase.rpc(fn, { p_listing: item.id });
          if (err) Alert.alert('Could not update', err.message);
          else load();
        },
      },
    ]);
  }

  function remove(item) {
    Alert.alert('Remove listing?', `"${item.title}" will be hidden from Browse.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error: err } = await supabase
            .from('listings')
            .update({ status: 'removed' })
            .eq('id', item.id)
            .eq('lister_id', userId);
          if (err) Alert.alert('Could not remove', err.message);
          else load();
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <ProfileCard userId={userId} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.sectionHead}>
        <Text style={styles.heading}>Your claims</Text>
        <Text style={styles.count}>{claims.length}</Text>
      </View>
      {claims.length === 0 ? <Text style={styles.empty}>No claims yet. Items you claim appear here.</Text> : null}
      {claims.map((it) => (
        <View key={it.id} style={styles.card}>
          <Text style={styles.cardTitle}>{it.title}</Text>
          <Text style={styles.meta}>
            {priceLabel(it.price)} · {it.area}
          </Text>

          {it.status === 'claimed' ? (
            <>
              <View style={styles.statusRow}>
                <Status tone="claimed">Collect by {formatDeadline(it.collect_by)}</Status>
              </View>
              <Text style={styles.meta}>Arrange pickup with {it.lister?.display_name || 'the lister'}.</Text>
              <Pressable style={styles.ghostBtn} onPress={() => cancelClaim(it)}>
                <Text style={styles.ghostBtnText}>Cancel claim</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.statusRow}>
              <Status tone={it.status === 'collected' ? 'done' : 'muted'}>
                {it.status === 'collected' ? 'Collected' : 'No longer claimed'}
              </Status>
            </View>
          )}
        </View>
      ))}

      <View style={styles.sectionHead}>
        <Text style={styles.heading}>Your listings</Text>
        <Text style={styles.count}>{listings.length}</Text>
      </View>
      {listings.length === 0 ? <Text style={styles.empty}>Nothing listed yet.</Text> : null}
      {listings.map((it) => (
        <View key={it.id} style={styles.card}>
          <Text style={styles.cardTitle}>{it.title}</Text>

          {it.status === 'claimed' ? (
            <>
              <View style={styles.statusRow}>
                <Status tone="claimed">Claimed · collect by {formatDeadline(it.collect_by)}</Status>
              </View>
              <Text style={styles.meta}>Claimed by {it.claimer?.display_name || 'a member'}</Text>
              <View style={styles.btnRow}>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() =>
                    recordOutcome(it, 'mark_collected', 'Mark as collected?', 'The claimer gets a completed collection on their profile.')
                  }
                >
                  <Ionicons name="checkmark" size={16} color={colors.card} />
                  <Text style={styles.primaryBtnText}>Collected</Text>
                </Pressable>
                <Pressable
                  style={styles.ghostBtn}
                  onPress={() =>
                    recordOutcome(it, 'mark_no_show', 'Claimer did not turn up?', 'The item goes back to Browse and the claimer gets a no-show.')
                  }
                >
                  <Text style={styles.ghostBtnText}>No-show</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.statusRow}>
              <Status tone={it.status === 'collected' ? 'done' : 'live'}>
                {it.status === 'collected' ? 'Collected' : 'Live'} · {priceLabel(it.price)}
              </Status>
            </View>
          )}

          {it.status === 'available' ? (
            <Pressable style={styles.ghostBtn} onPress={() => remove(it)}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={[styles.ghostBtnText, { color: colors.danger }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, paddingBottom: space.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg, marginBottom: space.sm },
  heading: { fontSize: 17, fontWeight: '700', color: colors.text },
  count: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    backgroundColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: space.md, marginBottom: space.sm },
  empty: { color: colors.muted, marginBottom: space.sm, fontSize: 14 },
  error: { color: colors.danger, marginBottom: space.sm },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    marginBottom: space.md,
    ...shadow,
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.accent },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  statusRow: { flexDirection: 'row', marginTop: space.sm, marginBottom: space.xs },
  status: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.text,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  opt: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  optOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  optText: { color: colors.text, fontSize: 14 },
  optTextOn: { color: colors.card, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md, alignItems: 'center' },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    marginTop: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 9,
  },
  ghostBtnText: { color: colors.text, fontWeight: '600' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    marginTop: space.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
  },
  primaryBtnText: { color: colors.card, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
