import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PRESSURE_UNIT } from '@/constants/monitor';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SensorData } from '@/types/sensor';

type PressureAlertProps = {
  reading: SensorData;
  /** Seconds pressure has stayed at or above the alert level. */
  duration: number;
};

export function PressureAlert({ reading, duration }: PressureAlertProps) {
  const theme = useTheme();

  const details = [
    { label: 'Pressure', value: `${reading.pressure.toFixed(1)} ${PRESSURE_UNIT}` },
    { label: 'Duration', value: `${duration} sec` },
    { label: 'Temperature', value: `${reading.temperature.toFixed(1)} deg C` },
    { label: 'Humidity', value: `${reading.humidity.toFixed(1)} %RH` },
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
        <ThemedText style={[styles.title, { color: theme.danger }]}>IMMEDIATE ALERT</ThemedText>
      </View>

      <ThemedText type="smallBold" style={{ color: theme.alertText }}>
        Prolonged pressure detected
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
