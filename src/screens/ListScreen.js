import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { AREAS, CATEGORIES, CONDITIONS, HAZARD_CONFIRM, HAZARD_WARNING, MATERIAL_AGES } from '../constants';
import { colors, radius, shadow, space } from '../theme';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

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

export default function ListScreen({ userId, onPosted }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState('0');
  const [condition, setCondition] = useState(CONDITIONS[0]);
  const [area, setArea] = useState(AREAS[0]);
  const [materialAge, setMaterialAge] = useState(null); // 'post_2000' | 'pre_2000' | 'unknown'
  const [hazardChecked, setHazardChecked] = useState(false);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null); // { uri, width, height }
  const [busy, setBusy] = useState(false);

  // Older or unclear materials need the warning and a confirmation before they can be posted.
  const needsHazardCheck = materialAge === 'pre_2000' || materialAge === 'unknown';

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos needed', 'Allow photo access in your phone settings to add a picture.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled && res.assets?.[0]) setPhoto(res.assets[0]);
  }

  // Uploads the photo and returns its storage path, or throws.
  async function uploadPhoto() {
    const response = await fetch(photo.uri);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_PHOTO_BYTES) throw new Error('That photo is over 5 MB. Try a smaller one.');

    const path = `${userId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('listing-photos')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return path;
  }

  async function submit() {
    const priceNum = Math.max(0, Number(price) || 0);
    if (title.trim().length < 3) {
      Alert.alert('Add a description', 'Say what it is in a few words, e.g. "3 boxes floor tiles 600x600".');
      return;
    }
    if (!materialAge) {
      Alert.alert('How old is it?', 'Choose post-2000, pre-2000, or not sure. This helps keep people safe.');
      return;
    }
    if (needsHazardCheck && !hazardChecked) {
      Alert.alert('Check before listing', 'Tick the box to confirm this isn’t asbestos or another hazardous material.');
      return;
    }
    if (!photo) {
      Alert.alert('Add a photo', 'Listings with a clear photo get claimed faster.', [
        { text: 'Post without photo', onPress: () => post(priceNum, null) },
        { text: 'Add photo', style: 'cancel' },
      ]);
      return;
    }
    post(priceNum, photo);
  }

  async function post(priceNum, chosen) {
    setBusy(true);
    try {
      const photoPath = chosen ? await uploadPhoto() : null;
      const { error } = await supabase.from('listings').insert({
        title: title.trim(),
        category,
        price: priceNum,
        condition,
        area,
        material_age: materialAge,
        notes: notes.trim() || 'Pickup by arrangement.',
        photo_path: photoPath,
        lister_id: userId,
        status: 'available',
      });
      if (error) throw error;

      setTitle('');
      setPrice('0');
      setNotes('');
      setPhoto(null);
      setMaterialAge(null);
      setHazardChecked(false);
      onPosted();
    } catch (err) {
      Alert.alert('Could not post', err.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>List spare materials</Text>
      <Text style={styles.intro}>Takes about a minute. Clear photos get claimed faster.</Text>

      <Text style={styles.label}>Photo</Text>
      <Pressable style={[styles.photoBox, photo && styles.photoBoxFilled]} onPress={pickPhoto}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
        ) : (
          <View style={styles.photoEmpty}>
            <Ionicons name="camera-outline" size={28} color={colors.accent} />
            <Text style={styles.photoHint}>Tap to add a photo</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.label}>What is it?</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 3 boxes floor tiles 600x600"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />

        <Chooser label="Category" options={CATEGORIES} value={category} onChange={setCategory} />

        <Text style={styles.label}>Price (£, 0 for free)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
          placeholderTextColor={colors.muted}
        />

        <Chooser label="Condition" options={CONDITIONS} value={condition} onChange={setCondition} />

        <Text style={styles.label}>How old is it?</Text>
        <View style={styles.options}>
          {MATERIAL_AGES.map((a) => {
            const on = materialAge === a.key;
            return (
              <Pressable
                key={a.key}
                onPress={() => {
                  setMaterialAge(a.key);
                  setHazardChecked(false);
                }}
                style={[styles.opt, on && styles.optOn]}
              >
                <Text style={[styles.optText, on && styles.optTextOn]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {needsHazardCheck ? (
          <View style={styles.warning}>
            <View style={styles.warningHead}>
              <Ionicons name="warning-outline" size={18} color={colors.danger} />
              <Text style={styles.warningTitle}>Possible asbestos</Text>
            </View>
            <Text style={styles.warningText}>{HAZARD_WARNING}</Text>
            <Pressable style={styles.checkRow} onPress={() => setHazardChecked(!hazardChecked)}>
              <Ionicons
                name={hazardChecked ? 'checkbox' : 'square-outline'}
                size={22}
                color={hazardChecked ? colors.accent : colors.muted}
              />
              <Text style={styles.checkText}>{HAZARD_CONFIRM}</Text>
            </Pressable>
          </View>
        ) : null}

        <Chooser label="Nearest area" options={AREAS} value={area} onChange={setArea} />

        <Text style={styles.label}>Pickup notes</Text>
        <TextInput
          style={[styles.input, styles.multi]}
          multiline
          placeholder="When and where to collect"
          placeholderTextColor={colors.muted}
          value={notes}
          onChangeText={setNotes}
          maxLength={500}
        />
      </View>

      <Pressable style={[styles.submit, busy && styles.disabled]} onPress={submit} disabled={busy}>
        <Ionicons name="paper-plane-outline" size={16} color={colors.card} />
        <Text style={styles.submitText}>{busy ? 'Posting…' : 'Post listing'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, paddingBottom: space.xl },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  intro: { fontSize: 13, color: colors.muted, marginTop: space.xs, marginBottom: space.sm },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: space.md, marginBottom: space.sm },
  photoBox: {
    height: 170,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.card,
    overflow: 'hidden',
    marginTop: space.xs,
  },
  photoBoxFilled: { borderStyle: 'solid', borderColor: colors.line },
  photoPreview: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  photoHint: { color: colors.muted, fontSize: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    marginTop: space.md,
    ...shadow,
  },
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
  multi: { minHeight: 84, textAlignVertical: 'top' },
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
  warning: {
    marginTop: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
    padding: space.md,
  },
  warningHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  warningTitle: { fontSize: 14, fontWeight: '700', color: colors.danger },
  warningText: { fontSize: 13, color: colors.text, lineHeight: 19, marginTop: space.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  checkText: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '600' },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: space.lg,
  },
  submitText: { color: colors.card, fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.5 },
});
