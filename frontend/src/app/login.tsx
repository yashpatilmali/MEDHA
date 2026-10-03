import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthLayout } from '@/components/auth-layout';
import { Button } from '@/components/button';
import { ScreenTitle } from '@/components/screen-title';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { APP_NAME } from '@/constants/brand';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/api/client';

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useSession();
  const { passwordReset } = useLocalSearchParams<{ passwordReset?: string }>();
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    if (!contact.trim() || !password) {
      setError('Enter your email or mobile number and your password.');
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      // On success the root layout swaps these screens for the dashboard.
      await signIn(contact, password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not log in. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to see your monitoring dashboard.">
      <ScreenTitle title="Login" />

      {passwordReset && (
        <ThemedView
          type="backgroundElement"
          style={[styles.notice, { borderLeftColor: theme.normal }]}>
          <ThemedText type="small">Password updated. Log in with your new password.</ThemedText>
        </ThemedView>
      )}

      <TextField
        label="Email / Mobile Number"
        value={contact}
        onChangeText={setContact}
        placeholder="you@example.com or 9876543210"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="username"
        textContentType="username"
      />

      <View style={styles.passwordGroup}>
        <TextField
          label="Password"
          password
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />
        <Link href="/forgot-password" style={[styles.link, styles.forgot, { color: theme.tint }]}>
          Forgot Password?
        </Link>
      </View>

      {error && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      )}

      <Button title="Login" onPress={handleLogin} loading={submitting} />

      <View style={styles.switchRow}>
        <ThemedText type="small" themeColor="textSecondary">
          New to {APP_NAME}?
        </ThemedText>
        <Link href="/signup" style={[styles.link, { color: theme.tint }]}>
          Create New Account
        </Link>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: Spacing.three,
  },
  passwordGroup: {
    gap: Spacing.two,
  },
  link: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
  },
  forgot: {
    alignSelf: 'flex-end',
  },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.one,
  },
});
