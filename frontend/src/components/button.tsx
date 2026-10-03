import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  /** Shows a spinner and ignores presses. */
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  /** Overrides the label color, e.g. theme.danger for a destructive action. */
  color?: string;
};

export function Button({ title, onPress, loading = false, variant = 'primary', color }: ButtonProps) {
  const theme = useTheme();
  const primary = variant === 'primary';
  const labelColor = color ?? (primary ? theme.onTint : theme.text);

  return (
    <Pressable
      role="button"
      aria-busy={loading}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? theme.tint : theme.backgroundElement },
        (pressed || loading) && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <ThemedText style={[styles.title, { color: labelColor }]}>{title}</ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
});
