import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../supabase';

export default function AuthScreen() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || password.length < 6) {
      Alert.alert('Check your details', 'Enter an email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    const fn = mode === 'signin' ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { error } = await fn.call(supabase.auth, { email: email.trim(), password });
    setBusy(false);
    if (error) {
      Alert.alert('Could not continue', error.message);
    } else if (mode === 'signup') {
      Alert.alert('Check your email', 'If email confirmation is on, confirm your address, then sign in.');
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Offcut</Text>
      <Text style={styles.lead}>Free local exchange for spare building materials.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (6+ characters)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={[styles.primary, busy && styles.disabled]} onPress={submit} disabled={busy}>
        <Text style={styles.primaryText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
      </Pressable>

      <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        <Text style={styles.switch}>
          {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#f6f5f2' },
  title: { fontSize: 28, fontWeight: '700', color: '#1d1d1b', marginBottom: 4 },
  lead: { fontSize: 15, color: '#6b6a66', marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#e4e2dc',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  primary: { backgroundColor: '#c2410c', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.5 },
  switch: { color: '#c2410c', textAlign: 'center', marginTop: 16 },
});
