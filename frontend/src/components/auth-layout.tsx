import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SparshLogo } from '@/components/sparsh-logo';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AuthLayoutProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  /** Smaller logo without the tagline, for longer forms. */
  compactLogo?: boolean;
}>;

/** Shared frame for the login, signup and password-reset screens. */
export function AuthLayout({ title, subtitle, compactLogo = false, children }: AuthLayoutProps) {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <KeyboardAwareScrollView
          bottomOffset={24}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.container}>
            <SparshLogo compact={compactLogo} />
            <View style={styles.heading}>
              <ThemedText style={styles.title}>{title}</ThemedText>
              {subtitle && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  {subtitle}
                </ThemedText>
              )}
            </View>
            {children}
          </View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  heading: {
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
  },
  centerText: {
    textAlign: 'center',
  },
});
