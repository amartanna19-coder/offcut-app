import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../supabase';
import { AREAS, ROLES, priceLabel } from '../constants';

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
        {options.map((o) => (
          <Pressable key={o} onPress={() => onChange(o)} style={[styles.opt, value === o && styles.optOn]}>
            <Text style={[styles.optText, value === o && styles.optTextOn]}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ProfileForm({ userId }) {
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
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{profile.display_name || 'Your profile'}</Text>
        <Text style={styles.meta}>
          {profile.role}
          {profile.trade ? ` · ${profile.trade}` : ''} · {profile.area}
        </Text>
        <Text style={styles.meta}>
          {profile.completed_count} completed {profile.completed_count === 1 ? 'collection' : 'collections'}
        </Text>
        <Pressable style={styles.smallBtn} onPress={() => setOpen(true)}>
          <Text style={styles.smallBtnText}>Edit profile</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Display name (shown to others)</Text>
      <TextInput
        style={styles.input}
        value={profile.display_name}
        onChangeText={(v) => setProfile({ ...profile, display_name: v })}
        maxLength={40}
        placeholder="e.g. Dave (Joiner)"
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
          />
        </>
      ) : null}
      <Chooser label="Area" options={AREAS} value={profile.area} onChange={(v) => setProfile({ ...profile, area: v })} />
      <Pressable style={[styles.submit, saving && styles.disabled]} onPress={save} disabled={saving}>
        <Text style={styles.submitText}>{saving ? 'Saving…' : 'Save profile'}</Text>
      </Pressable>
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
      <ProfileForm userId={userId} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.heading}>Your claims</Text>
      {claims.length === 0 ? <Text style={styles.empty}>No claims yet.</Text> : null}
      {claims.map((it) => (
        <View key={it.id} style={styles.card}>
          <Text style={styles.cardTitle}>{it.title}</Text>
          {it.status === 'claimed' ? (
            <>
              <Text style={styles.claimed}>Arrange pickup with {it.lister?.display_name || 'the lister'}.</Text>
              <Text style={styles.deadline}>Collect by {formatDeadline(it.collect_by)}</Text>
              <Pressable style={styles.smallBtn} onPress={() => cancelClaim(it)}>
                <Text style={styles.smallBtnText}>Cancel claim</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.meta}>{it.status === 'collected' ? 'Collected' : 'No longer claimed'}</Text>
          )}
          <Text style={styles.meta}>
            {priceLabel(it.price)} · {it.area}
          </Text>
        </View>
      ))}

      <Text style={styles.heading}>Your listings</Text>
      {listings.length === 0 ? <Text style={styles.empty}>Nothing listed yet.</Text> : null}
      {listings.map((it) => (
        <View key={it.id} style={styles.card}>
          <Text style={styles.cardTitle}>{it.title}</Text>

          {it.status === 'claimed' ? (
            <>
              <Text style={styles.claimed}>Claimed by {it.claimer?.display_name || 'a member'}</Text>
              <Text style={styles.deadline}>Collect by {formatDeadline(it.collect_by)}</Text>
              <View style={styles.btnRow}>
                <Pressable
                  style={[styles.smallBtn, styles.primarySmall]}
                  onPress={() =>
                    recordOutcome(it, 'mark_collected', 'Mark as collected?', 'The claimer gets a completed collection on their profile.')
                  }
                >
                  <Text style={styles.primarySmallText}>Collected</Text>
                </Pressable>
                <Pressable
                  style={styles.smallBtn}
                  onPress={() =>
                    recordOutcome(it, 'mark_no_show', 'Claimer did not turn up?', 'The item goes back to Browse and the claimer gets a no-show.')
                  }
                >
                  <Text style={styles.smallBtnText}>No-show</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={styles.meta}>
              {it.status === 'collected' ? 'Collected' : 'Live'} · {priceLabel(it.price)}
            </Text>
          )}

          {it.status === 'available' ? (
            <Pressable style={styles.smallBtn} onPress={() => remove(it)}>
              <Text style={[styles.smallBtnText, { color: '#b91c1c' }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 32 },
  heading: { fontSize: 16, fontWeight: '600', color: '#1d1d1b', marginTop: 16, marginBottom: 8 },
  label: { fontSize: 14, color: '#6b6a66', marginTop: 12, marginBottom: 6 },
  empty: { color: '#6b6a66', marginBottom: 8 },
  error: { color: '#b91c1c', marginBottom: 8 },
  card: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e4e2dc', padding: 14, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1d1d1b' },
  claimed: { color: '#15803d', fontWeight: '600', marginTop: 4 },
  deadline: { color: '#b45309', fontWeight: '600', marginTop: 4 },
  meta: { fontSize: 13, color: '#6b6a66', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#e4e2dc', backgroundColor: '#f6f5f2', borderRadius: 10, padding: 12, fontSize: 16 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#e4e2dc', backgroundColor: '#ffffff' },
  optOn: { backgroundColor: '#c2410c', borderColor: '#c2410c' },
  optText: { color: '#1d1d1b', fontSize: 14 },
  optTextOn: { color: '#ffffff' },
  btnRow: { flexDirection: 'row', gap: 8 },
  smallBtn: { alignSelf: 'flex-start', marginTop: 10, borderWidth: 1, borderColor: '#e4e2dc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  smallBtnText: { color: '#1d1d1b' },
  primarySmall: { backgroundColor: '#c2410c', borderColor: '#c2410c' },
  primarySmallText: { color: '#ffffff', fontWeight: '600' },
  submit: { backgroundColor: '#c2410c', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#ffffff', fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
