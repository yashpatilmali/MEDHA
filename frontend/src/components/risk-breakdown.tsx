import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MAX_RISK_SCORE, type Risk } from '@/types/monitoring';

const PRESSURE_WEIGHT = 2;
const DURATION_WEIGHT = 2;

export function RiskBreakdown({ risk }: { risk: Risk }) {
  const theme = useTheme();

  const rows = [
    { label: `Pressure score x${PRESSURE_WEIGHT}`, score: risk.pressureScore },
    { label: 'Temperature score', score: risk.temperatureScore },
    { label: 'Humidity score', score: risk.humidityScore },
    { label: `Duration score x${DURATION_WEIGHT}`, score: risk.durationScore },
  ];

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">Risk calculation</ThemedText>

      {rows.map(({ label, score }) => (
        <View key={label} style={[styles.row, { borderBottomColor: theme.backgroundSelected }]}>
          <ThemedText type="small" themeColor="textSecondary">
            {label}
          </ThemedText>
          <ThemedText type="smallBold">{score}</ThemedText>
        </View>
      ))}

      <View style={styles.totalRow}>
        <ThemedText type="code" style={styles.formula}>
          Risk = {PRESSURE_WEIGHT}({risk.pressureScore}) + {risk.temperatureScore} +{' '}
          {risk.humidityScore} + {DURATION_WEIGHT}({risk.durationScore})
        </ThemedText>
        <ThemedText type="smallBold">
          {risk.riskScore} / {MAX_RISK_SCORE}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  formula: {
    flexShrink: 1,
  },
});
