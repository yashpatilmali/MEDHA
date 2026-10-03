import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PRESSURE_UNIT } from '@/constants/monitor';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Risk } from '@/types/monitoring';
import type { SensorData } from '@/types/sensor';
import { formatSigned } from '@/utils/format';

type CriticalAlertProps = {
  reading: SensorData;
  risk: Risk;
  /** Seconds pressure has stayed elevated above the baseline. */
  duration: number;
};

export function CriticalAlert({ reading, risk, duration }: CriticalAlertProps) {
  const theme = useTheme();
  const { deltas } = risk;

  const details = [
    {
      label: 'Pressure',
      value: `${reading.pressure.toFixed(1)} ${PRESSURE_UNIT} (${formatSigned(deltas.pressure)})`,
    },
    { label: 'Elevated for', value: `${duration} sec` },
    {
      label: 'Temperature',
      value: `${reading.temperature.toFixed(1)} deg C (${formatSigned(deltas.temperature)})`,
    },
    { label: 'Humidity', value: `${reading.humidity.toFixed(1)} %RH (${formatSigned(deltas.humidity)})` },
  ];

  return (
    <View
      role="alert"
      aria-live="assertive"
      style={[
        styles.card,
        { backgroundColor: theme.alertBackground, borderColor: theme.alertBorder },
      ]}>
      <View style={styles.titleRow}>
        <SymbolView
          name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
          size={20}
          tintColor={theme.danger}
        />
        <ThemedText style={[styles.title, { color: theme.danger }]}>CRITICAL ALERT</ThemedText>
      </View>

      <ThemedText type="smallBold" style={{ color: theme.alertText }}>
        {"Readings are well above this patient's baseline"}
      </ThemedText>

      <View style={styles.details}>
        {details.map(({ label, value }) => (
          <View key={label} style={styles.detailRow}>
            <ThemedText type="small" style={{ color: theme.alertText }}>
              {label}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: theme.alertText }}>
              {value}
            </ThemedText>
          </View>
        ))}
      </View>

      <ThemedText type="smallBold" style={{ color: theme.danger }}>
        Consider checking or repositioning the patient.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
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
  },
});
