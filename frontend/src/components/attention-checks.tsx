import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PRESSURE_UNIT } from '@/constants/monitor';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Risk } from '@/types/monitoring';
import type { SensorData } from '@/types/sensor';
import { formatSigned } from '@/utils/format';

type AttentionChecksProps = {
  reading: SensorData;
  risk: Risk;
  /** Seconds pressure has stayed at or above 32 mmHg. */
  duration: number;
};

/** Each ATTENTION rule, the patient's current value against it, and whether it is met. */
export function AttentionChecks({ reading, risk, duration }: AttentionChecksProps) {
  const theme = useTheme();
  const { triggers, deltas, percentChanges, thresholds, pressureAttentionPercent } = risk;

  const rows = [
    {
      label: 'Pressure',
      rule:
        `≥ ${thresholds.pressure} ${PRESSURE_UNIT} for ≥ ${thresholds.durationSeconds} s` +
        (pressureAttentionPercent === null
          ? ''
          : ` (${formatSigned(pressureAttentionPercent)} % from this patient's baseline)`),
      value: `${reading.pressure.toFixed(1)} ${PRESSURE_UNIT}${duration > 0 ? `, ${duration} s` : ''}`,
      met: triggers.pressure,
    },
    {
      label: 'Temperature',
      rule: `Rise ≥ ${thresholds.temperatureRisePercent} % from baseline`,
      value:
        percentChanges.temperature === null
          ? 'No baseline'
          : `${formatSigned(percentChanges.temperature)} % (${formatSigned(deltas.temperature)} deg C)`,
      met: triggers.temperature,
    },
    {
      label: 'Humidity',
      rule: `Rise ≥ ${thresholds.humidityRisePercent} % from baseline`,
      value:
        percentChanges.humidity === null ? 'No baseline' : `${formatSigned(percentChanges.humidity)} %`,
      met: triggers.humidity,
    },
  ];

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">Attention checks</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        ATTENTION if any rule is met. Otherwise NORMAL.
      </ThemedText>

      {rows.map(({ label, rule, value, met }) => (
        <View key={label} style={[styles.row, { borderTopColor: theme.backgroundSelected }]}>
          <View style={styles.ruleText}>
            <ThemedText type="smallBold">{label}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {rule}
            </ThemedText>
          </View>
          <View style={styles.result}>
            <ThemedText type="smallBold">{value}</ThemedText>
            <ThemedText type="caption" style={{ color: met ? theme.attention : theme.normal }}>
              {met ? 'ATTENTION' : 'Normal'}
            </ThemedText>
          </View>
        </View>
      ))}

      <ThemedText type="caption" themeColor="textSecondary" style={styles.note}>
        Prototype rules derived from the reference study, not clinically validated thresholds.
      </ThemedText>
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
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ruleText: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  result: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  note: {
    paddingTop: Spacing.one,
  },
});
