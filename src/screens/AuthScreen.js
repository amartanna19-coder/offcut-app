import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { colors, radius, shadow, space } from '../theme';

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

  const signin = mode === 'signin';

  return (
    <View style={styles.wrap}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Ionicons name="construct-outline" size={28} color={colors.card} />
        </View>
        <Text style={styles.title}>Offcut</Text>
        <Text style={styles.lead}>Free local exchange for spare building materials.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>{signin ? 'Welcome back' : 'Create your account'}</Text>

        <View style={styles.field}>
          <Ionicons name="mail-outline" size={18} color={colors.muted} style={styles.fieldIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.field}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.muted} style={styles.fieldIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password (6+ characters)"
            placeholderTextColor={colors.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <Pressable style={[styles.primary, busy && styles.disabled]} onPress={submit} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? 'Please wait…' : signin ? 'Sign in' : 'Create account'}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.switchRow} onPress={() => setMode(signin ? 'signup' : 'signin')}>
        <Text style={styles.switch}>
          {signin ? 'New here? Create an account' : 'Have an account? Sign in'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space.xl, justifyContent: 'center', backgroundColor: colors.bg },
  brand: { alignItems: 'center', marginBottom: space.xl },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  lead: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: space.xs, paddingHorizontal: space.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    ...shadow,
  },
  heading: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: space.md },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    paddingHorizontal: space.md,
    marginBottom: space.md,
  },
  fieldIcon: { marginRight: space.sm },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.text },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: space.xs },
  primaryText: { color: colors.card, fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.5 },
  switchRow: { marginTop: space.lg, alignItems: 'center' },
  switch: { color: colors.accent, fontWeight: '600' },
});
