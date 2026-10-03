import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PRESSURE_UNIT } from '@/constants/monitor';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Calibration } from '@/types/monitoring';
import { formatDateTime } from '@/utils/format';

type CalibrationCardProps = {
  calibration: Calibration;
  now: number;
};

/**
 * The 1-minute initial scan: progress while it runs, then the baseline (initial readings) every
 * later reading is compared with. Nothing before the scan is started.
 */
export function CalibrationCard({ calibration, now }: CalibrationCardProps) {
  const theme = useTheme();
  const { baseline, status } = calibration;
  if (status === 'none') return null;

  if (status === 'complete' && baseline) {
    const values = [
      { label: 'PRESSURE', value: baseline.pressure.toFixed(1), unit: PRESSURE_UNIT },
      { label: 'TEMPERATURE', value: baseline.temperature.toFixed(1), unit: 'deg C' },
      { label: 'HUMIDITY', value: baseline.humidity.toFixed(1), unit: '%RH' },
    ];
    return (
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <ThemedText type="overline" themeColor="textSecondary">
          Baseline (initial readings)
        </ThemedText>
        <View style={styles.values}>
          {values.map(({ label, value, unit }) => (
            <View key={label} style={styles.value}>
              <ThemedText type="caption" themeColor="textSecondary">
                {label}
              </ThemedText>
              <ThemedText type="smallBold">
                {value} {unit}
              </ThemedText>
            </View>
          ))}
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          Average of {baseline.samples} readings, scanned {formatDateTime(baseline.calibratedAt)}.
          Rescan whenever the patch is re-applied.
        </ThemedText>
      </ThemedView>
    );
  }

  const endsAt = calibration.endsAt ? Date.parse(calibration.endsAt) : null;
  const total = calibration.durationSeconds;
  const secondsLeft = endsAt === null ? total : Math.max(0, Math.ceil((endsAt - now) / 1000));
  const progress = (total - secondsLeft) / total;

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, styles.calibrating, { borderColor: theme.tint }]}>
      <View style={styles.titleRow}>
        <ActivityIndicator color={theme.tint} />
        <ThemedText type="heading">Scanning initial readings</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {status === 'waiting'
          ? 'The 1-minute scan starts with the next reading from the patch.'
          : 'Keep the patient still while the patch measures their normal pressure, temperature and humidity.'}
      </ThemedText>

      <View
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={total - secondsLeft}
        style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { backgroundColor: theme.tint, width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.progressRow}>
        <ThemedText type="smallBold">
          {status === 'waiting'
            ? 'Waiting for the device'
            : secondsLeft > 0
              ? `${secondsLeft} s left`
              : 'Finishing...'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {calibration.samples} reading{calibration.samples === 1 ? '' : 's'}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  calibrating: {
    borderWidth: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  values: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.four,
    rowGap: Spacing.two,
  },
  value: {
    gap: Spacing.half,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
