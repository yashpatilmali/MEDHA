import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { APP_NAME, APP_TAGLINE } from '@/constants/brand';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SparshMarkProps = {
  size: number;
  color: string;
};

/**
 * The Sparsh "touch ripple": a dot inside two fading rings. The app icon and splash image in
 * assets/images use the same proportions.
 */
export function SparshMark({ size, color }: SparshMarkProps) {
  const ring = (diameter: number, opacity: number) => ({
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    borderWidth: size * 0.07,
    borderColor: color,
    opacity,
  });

  return (
    <View style={[styles.mark, { width: size, height: size }]}>
      <View style={[styles.layer, ring(size, 0.35)]} />
      <View style={[styles.layer, ring(size * 0.66, 0.65)]} />
      <View
        style={{
          width: size * 0.32,
          height: size * 0.32,
          borderRadius: size * 0.16,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Mark, name and tagline, stacked. `compact` leaves out the tagline and shrinks the rest. */
export function SparshLogo({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();

  return (
    <View style={styles.logo}>
      <SparshMark size={compact ? 44 : 72} color={theme.tint} />
      <ThemedText style={compact ? styles.wordmarkCompact : styles.wordmark}>{APP_NAME}</ThemedText>
      {!compact && (
        <ThemedText type="small" themeColor="textSecondary">
          {APP_TAGLINE}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
  },
  logo: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  wordmark: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: 800,
    letterSpacing: 0.5,
    marginTop: Spacing.two,
  },
  wordmarkCompact: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: 800,
    letterSpacing: 0.5,
  },
});
