import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Risk } from '@/types/monitoring';

export function RiskBreakdown({ risk }: { risk: Risk }) {
  const theme = useTheme();

  const { weights } = risk;
  const label = (name: string, weight: number) => `${name} score${weight === 1 ? '' : ` x${weight}`}`;
  const term = (score: number, weight: number) => (weight === 1 ? `${score}` : `${weight}(${score})`);

  const rows = [
    { label: label('Pressure rise', weights.pressure), score: risk.pressureScore },
    { label: label('Temperature rise', weights.temperature), score: risk.temperatureScore },
    { label: label('Humidity rise', weights.humidity), score: risk.humidityScore },
    { label: label('Duration', weights.duration), score: risk.durationScore },
  ];

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">Risk calculation (rise above baseline)</ThemedText>

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
          Risk = {term(risk.pressureScore, weights.pressure)} +{' '}
          {term(risk.temperatureScore, weights.temperature)} +{' '}
          {term(risk.humidityScore, weights.humidity)} + {term(risk.durationScore, weights.duration)}
        </ThemedText>
        <ThemedText type="smallBold">
          {risk.riskScore} / {risk.maxScore}
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
