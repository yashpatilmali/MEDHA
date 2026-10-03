import type { PropsWithChildren } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Scrolling page for a tab screen, kept clear of the status bar and tab bar on every platform. */
export function TabScreen({ children }: PropsWithChildren) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Native tabs inset this ScrollView automatically on iOS and keep it above the tab bar on
  // Android, so Android only needs its top and side edges padded. On web, leave room for the tab
  // bar floating over the top of the page.
  const platformPadding = Platform.select({
    android: {
      paddingTop: insets.top + Spacing.three,
      paddingLeft: insets.left + Spacing.three,
      paddingRight: insets.right + Spacing.three,
    },
    web: { paddingTop: Spacing.six },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.contentContainer, platformPadding]}>
      <View style={styles.container}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
  container: {
    flexGrow: 1,
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
});
