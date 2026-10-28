import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabase';
import { AREAS, CATEGORIES, CONDITIONS } from '../constants';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

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

export default function ListScreen({ userId, onPosted }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState('0');
  const [condition, setCondition] = useState(CONDITIONS[0]);
  const [area, setArea] = useState(AREAS[0]);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null); // { uri, width, height }
  const [busy, setBusy] = useState(false);

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

      <Text style={styles.label}>Photo</Text>
      <Pressable style={styles.photoBox} onPress={pickPhoto}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
        ) : (
          <Text style={styles.photoHint}>Tap to add a photo</Text>
        )}
      </Pressable>

      <Text style={styles.label}>What is it?</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 3 boxes floor tiles 600x600"
        value={title}
        onChangeText={setTitle}
        maxLength={120}
      />

      <Chooser label="Category" options={CATEGORIES} value={category} onChange={setCategory} />

      <Text style={styles.label}>Price (£, 0 for free)</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={price} onChangeText={setPrice} />

      <Chooser label="Condition" options={CONDITIONS} value={condition} onChange={setCondition} />
      <Chooser label="Nearest area" options={AREAS} value={area} onChange={setArea} />

      <Text style={styles.label}>Pickup notes</Text>
      <TextInput
        style={[styles.input, styles.multi]}
        multiline
        placeholder="When and where to collect"
        value={notes}
        onChangeText={setNotes}
        maxLength={500}
      />

      <Pressable style={[styles.submit, busy && styles.disabled]} onPress={submit} disabled={busy}>
        <Text style={styles.submitText}>{busy ? 'Posting…' : 'Post listing'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 32 },
  heading: { fontSize: 18, fontWeight: '600', color: '#1d1d1b', marginBottom: 8 },
  label: { fontSize: 14, color: '#6b6a66', marginTop: 12, marginBottom: 6 },
  photoBox: {
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#c9c6bd',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoHint: { color: '#6b6a66' },
  input: {
    borderWidth: 1,
    borderColor: '#e4e2dc',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  multi: { minHeight: 80, textAlignVertical: 'top' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#e4e2dc', backgroundColor: '#ffffff' },
  optOn: { backgroundColor: '#c2410c', borderColor: '#c2410c' },
  optText: { color: '#1d1d1b', fontSize: 14 },
  optTextOn: { color: '#ffffff' },
  submit: { backgroundColor: '#c2410c', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.5 },
});
