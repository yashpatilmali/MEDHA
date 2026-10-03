import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SensorCardProps = {
  title: string;
  value: string;
  unit: string;
  status: string;
  statusColor: string;
};

export function SensorCard({ title, value, unit, status, statusColor }: SensorCardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="overline" themeColor="textSecondary">{title}</ThemedText>
      <View style={styles.valueRow}>
        <ThemedText style={styles.value}>{value}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{unit}</ThemedText>
      </View>
      <ThemedText type="caption" style={{ color: statusColor }}>{status}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
});
