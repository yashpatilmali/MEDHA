import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthLayout } from '@/components/auth-layout';
import { Button } from '@/components/button';
import { ScreenTitle } from '@/components/screen-title';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { APP_NAME } from '@/constants/brand';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/api/client';
import { isValidMobile } from '@/utils/contact';
import { SEX_OPTIONS, type Sex } from '@/types/patient';

type Form = {
  name: string;
  age: string;
  sex: Sex | null;
  contact: string;
  caretakerName: string;
  caretakerPhone: string;
  password: string;
  confirmPassword: string;
};

type Errors = Partial<Record<keyof Form, string>>;
const MIN_PASSWORD_LENGTH = 6;

function validate(form: Form): Errors {
  const errors: Errors = {};
  const age = Number(form.age);

  if (form.name.trim().length < 2) errors.name = "Enter the patient's full name.";
  if (!form.age || age < 1 || age > 120) errors.age = 'Enter an age between 1 and 120.';
  if (!form.sex) errors.sex = "Select the patient's sex.";
  if (!isValidMobile(form.contact)) errors.contact = 'Enter a valid mobile number.';
  if (form.caretakerName.trim().length < 2) errors.caretakerName = "Enter the caretaker's name.";
  if (!isValidMobile(form.caretakerPhone)) {
    errors.caretakerPhone = 'Enter a valid mobile number for SMS alerts.';
  }
  if (form.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';

  return errors;
}

export default function SignupScreen() {
  const theme = useTheme();
  const { signUp } = useSession();
  const [form, setForm] = useState<Form>({
    name: '',
    age: '',
    sex: null,
    contact: '',
    caretakerName: '',
    caretakerPhone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSignup() {
    const found = validate(form);
    setErrors(found);
    setFormError(undefined);
    if (Object.keys(found).length > 0 || !form.sex) return;

    setSubmitting(true);
    try {
      // On success the root layout takes the new patient straight to their dashboard.
      await signUp({
        name: form.name,
        age: Number(form.age),
        sex: form.sex,
        contact: form.contact,
        password: form.password,
        caretakerName: form.caretakerName,
        caretakerPhone: form.caretakerPhone,
      });
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields);
        setFormError(Object.keys(e.fields).length ? undefined : e.message);
      } else {
        setFormError('Could not create the account. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      compactLogo
      title="Patient Registration"
      subtitle={`Create your ${APP_NAME} account. Your Patient ID is assigned automatically.`}>
      <ScreenTitle title="Create Account" />

      <TextField
        label="Full Patient Name"
        value={form.name}
        onChangeText={(value) => update('name', value)}
        error={errors.name}
        placeholder="e.g. Rahul Sharma"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />

      <TextField
        label="Age"
        value={form.age}
        onChangeText={(value) => update('age', value.replace(/\D/g, ''))}
        error={errors.age}
        placeholder="e.g. 68"
        keyboardType="number-pad"
        maxLength={3}
      />

      <View style={styles.field}>
        <ThemedText type="smallBold">Sex</ThemedText>
        <SegmentedControl
          label="Sex"
          options={SEX_OPTIONS}
          value={form.sex}
          onChange={(value) => update('sex', value)}
          invalid={Boolean(errors.sex)}
        />
        {errors.sex && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {errors.sex}
          </ThemedText>
        )}
      </View>

      <TextField
        label="Mobile Number"
        value={form.contact}
        onChangeText={(value) => update('contact', value)}
        error={errors.contact}
        placeholder="e.g. 9876543210 or +919876543210"
        keyboardType="phone-pad"
        // Also the login username, so password managers save it with the password.
        autoComplete="username"
        textContentType="username"
      />

      <TextField
        label="Patient Account Password"
        password
        value={form.password}
        onChangeText={(value) => update('password', value)}
        error={errors.password}
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <TextField
        label="Confirm Password"
        password
        value={form.confirmPassword}
        onChangeText={(value) => update('confirmPassword', value)}
        error={errors.confirmPassword}
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <View style={styles.section}>
        <ThemedText type="heading">Caretaker</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Only receives SMS alerts when the patient&apos;s status turns ATTENTION. No
          account or password is created for the caretaker.
        </ThemedText>
      </View>

      <TextField
        label="Caretaker Name"
        value={form.caretakerName}
        onChangeText={(value) => update('caretakerName', value)}
        error={errors.caretakerName}
        placeholder="e.g. Sunita Sharma"
        autoCapitalize="words"
      />

      <TextField
        label="Caretaker Mobile Number"
        value={form.caretakerPhone}
        onChangeText={(value) => update('caretakerPhone', value)}
        error={errors.caretakerPhone}
        placeholder="e.g. 9876543210 or +919876543210"
        keyboardType="phone-pad"
        autoComplete="off"
        returnKeyType="go"
        onSubmitEditing={handleSignup}
      />

      {formError && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {formError}
        </ThemedText>
      )}

      <Button title="Create Account" onPress={handleSignup} loading={submitting} />

      <View style={styles.switchRow}>
        <ThemedText type="small" themeColor="textSecondary">
          Already have an account?
        </ThemedText>
        <Link href="/login" dismissTo style={[styles.link, { color: theme.tint }]}>
          Login
        </Link>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one + Spacing.half,
  },
  section: {
    gap: Spacing.half,
    marginTop: Spacing.two,
  },
  link: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
  },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.one,
  },
});
