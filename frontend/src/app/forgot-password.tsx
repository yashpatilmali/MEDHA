import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthLayout } from '@/components/auth-layout';
import { Button } from '@/components/button';
import { ScreenTitle } from '@/components/screen-title';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, api } from '@/api/client';
import { isValidContact } from '@/utils/contact';

const MIN_PASSWORD_LENGTH = 6;

type Form = {
  contact: string;
  code: string;
  password: string;
  confirmPassword: string;
};

type Errors = Partial<Record<keyof Form, string>>;

function validate(form: Form): Errors {
  const errors: Errors = {};
  if (!isValidContact(form.contact)) {
    errors.contact = 'Enter the email address or mobile number you registered with.';
  }
  if (!/^\d{6}$/.test(form.code)) errors.code = 'Enter the 6-digit reset code.';
  if (form.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [form, setForm] = useState<Form>({
    contact: '',
    code: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function requestCode() {
    if (!isValidContact(form.contact)) {
      setErrors({ contact: 'Enter the email address or mobile number you registered with.' });
      return;
    }
    setSubmitting(true);
    setFormError(undefined);
    try {
      await api.forgotPassword(form.contact);
      setCodeSent(true);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Could not send the reset code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    const found = validate(form);
    setErrors(found);
    setFormError(undefined);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await api.resetPassword(form.contact, form.code, form.password);
      router.dismissTo({ pathname: '/login', params: { passwordReset: '1' } });
    } catch (e) {
      setFormError(
        e instanceof ApiError ? e.message : 'Could not reset the password. Please try again.'
      );
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      compactLogo
      title="Reset Password"
      subtitle="Request a reset code, then choose a new password.">
      <ScreenTitle title="Reset Password" />

      <TextField
        label="Email / Mobile Number"
        value={form.contact}
        onChangeText={(value) => update('contact', value)}
        error={errors.contact}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="username"
        textContentType="username"
      />

      {!codeSent ? (
        <Button title="Send Reset Code" onPress={requestCode} loading={submitting} />
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Check your email, or ask the server administrator for the code if this account uses a mobile number.
          </ThemedText>
          <TextField
            label="6-digit Reset Code"
            value={form.code}
            onChangeText={(value) => update('code', value.replace(/\D/g, '').slice(0, 6))}
            error={errors.code}
            keyboardType="number-pad"
            maxLength={6}
          />

      <TextField
        label="New Password"
        password
        value={form.password}
        onChangeText={(value) => update('password', value)}
        error={errors.password}
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <TextField
        label="Confirm New Password"
        password
        value={form.confirmPassword}
        onChangeText={(value) => update('confirmPassword', value)}
        error={errors.confirmPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleReset}
      />

      {formError && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {formError}
        </ThemedText>
      )}

          <Button title="Reset Password" onPress={handleReset} loading={submitting} />
        </>
      )}

      <View style={styles.switchRow}>
        <Link href="/login" dismissTo style={[styles.link, { color: theme.tint }]}>
          Back to Login
        </Link>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  link: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
  },
  switchRow: {
    alignItems: 'center',
  },
});
