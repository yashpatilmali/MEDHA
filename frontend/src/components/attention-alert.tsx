import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PRESSURE_UNIT } from '@/constants/monitor';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Risk } from '@/types/monitoring';
import type { SensorData } from '@/types/sensor';
import { formatSigned } from '@/utils/format';

type AttentionAlertProps = {
  reading: SensorData;
  risk: Risk;
  /** Seconds pressure has stayed at or above 32 mmHg. */
  duration: number;
};

const HEADLINES = {
  pressure: 'Prolonged pressure detected',
  temperature: 'Skin temperature rising',
  humidity: 'Skin moisture rising',
} as const;

/** Shown while the status is ATTENTION: what triggered it and what to do. */
export function AttentionAlert({ reading, risk, duration }: AttentionAlertProps) {
  const theme = useTheme();
  const { triggers, deltas, percentChanges } = risk;
  const headlines = (Object.keys(HEADLINES) as (keyof typeof HEADLINES)[])
    .filter((key) => triggers[key])
    .map((key) => HEADLINES[key]);

  const details = [
    {
      label: 'Pressure',
      value: `${reading.pressure.toFixed(1)} ${PRESSURE_UNIT}${duration > 0 ? ` for ${duration} s` : ''}`,
      active: triggers.pressure,
    },
    {
      label: 'Temperature',
      value:
        percentChanges.temperature === null
          ? `${formatSigned(deltas.temperature)} deg C vs baseline`
          : `${formatSigned(percentChanges.temperature)} % vs baseline`,
      active: triggers.temperature,
    },
    {
      label: 'Humidity',
      value:
        percentChanges.humidity === null
          ? `${formatSigned(deltas.humidity)} %RH vs baseline`
          : `${formatSigned(percentChanges.humidity)} % vs baseline`,
      active: triggers.humidity,
    },
  ];

  return (
    <View
      role="alert"
      aria-live="assertive"
      style={[styles.card, { backgroundColor: theme.attentionSoft, borderColor: theme.attention }]}>
      <View style={styles.titleRow}>
        <SymbolView
          name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
          size={20}
          tintColor={theme.attention}
        />
        <ThemedText style={[styles.title, { color: theme.attention }]}>ATTENTION</ThemedText>
      </View>

      {headlines.map((headline) => (
        <ThemedText key={headline} type="smallBold">
          {headline}
        </ThemedText>
      ))}

      <View style={styles.details}>
        {details.map(({ label, value, active }) => (
          <View key={label} style={styles.detailRow}>
            <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
              {label}
            </ThemedText>
            <ThemedText
              type={active ? 'smallBold' : 'small'}
              themeColor={active ? 'text' : 'textSecondary'}
              style={styles.detailValue}>
              {value}
            </ThemedText>
          </View>
        ))}
      </View>

      <ThemedText type="smallBold" style={{ color: theme.attention }}>
        Please check / reposition the patient.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 800,
    letterSpacing: 0.5,
  },
  details: {
    gap: Spacing.half,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  detailValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
