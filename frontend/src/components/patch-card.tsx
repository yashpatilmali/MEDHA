import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PatchStatus } from '@/types/monitoring';
import { formatAgo, formatDateTime, formatDuration } from '@/utils/format';
import { activationOverdue, patchPhase, type PatchPhase } from '@/utils/patch';

type PatchCardProps = {
  status: PatchStatus;
  now: number;
  onActivate: () => Promise<void>;
  onScan: () => Promise<void>;
  onDeactivate: () => Promise<void>;
};

const PHASE_LABELS: Record<PatchPhase, string> = {
  off: 'OFF',
  activating: 'ACTIVATING',
  ready: 'ACTIVATED',
  scanning: 'SCANNING',
  monitoring: 'MONITORING',
  offline: 'OFFLINE',
};

/**
 * Controls the sensor patch: activate its sensors, scan the initial readings, deactivate. Shows
 * whether the patch has confirmed it is on, and how long it has been on the body.
 */
export function PatchCard({ status, now, onActivate, onScan, onDeactivate }: PatchCardProps) {
  const theme = useTheme();
  const [busy, setBusy] = useState<'activate' | 'scan' | 'deactivate' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { device, calibration } = status;
  const phase = patchPhase(device, calibration, now);

  async function run(action: 'activate' | 'scan' | 'deactivate', task: () => Promise<void>) {
    setBusy(action);
    setError(null);
    try {
      await task();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  const phaseColor: Record<PatchPhase, string> = {
    off: theme.textSecondary,
    activating: theme.attention,
    ready: theme.normal,
    scanning: theme.tint,
    monitoring: theme.normal,
    offline: theme.danger,
  };

  const lastSeen = device.lastSeenAt ? Date.parse(device.lastSeenAt) : null;
  const secondsSinceSeen = lastSeen === null ? null : Math.max(0, Math.floor((now - lastSeen) / 1000));

  let message: string;
  switch (phase) {
    case 'off':
      message = 'Place the patch on the patient, then activate the sensors.';
      break;
    case 'activating':
      message = activationOverdue(device, now)
        ? "The patch hasn't responded. Check it is switched on and connected to Wi-Fi."
        : 'Waiting for the patch to switch its sensors on...';
      break;
    case 'ready':
      message =
        'Sensors are on and sending readings. Keep the patient still, then scan the initial readings to set their baseline.';
      break;
    case 'scanning':
      message = 'Taking the initial readings for 1 minute. Continuous monitoring starts after.';
      break;
    case 'monitoring':
      message = 'Continuous monitoring against the initial readings.';
      break;
    case 'offline':
      message = `The patch stopped responding ${formatAgo(secondsSinceSeen ?? 0)}. Check its power and Wi-Fi.`;
      break;
  }

  const rows: { label: string; value: string; color?: string }[] = [];
  if (device.active) {
    rows.push({
      label: 'Patch',
      value:
        secondsSinceSeen === null
          ? 'Not seen yet'
          : phase === 'offline'
            ? `Offline, last seen ${formatAgo(secondsSinceSeen)}`
            : 'Online',
      color: phase === 'offline' ? theme.danger : undefined,
    });
    rows.push({
      label: 'Sensors',
      value:
        phase === 'activating'
          ? 'Switching on...'
          : device.sensorsOk === false
            ? 'Not responding: check the DHT11 wiring'
            : 'Activated',
      color: device.sensorsOk === false ? theme.danger : theme.normal,
    });
  }
  if (device.wearStartedAt) {
    rows.push({
      label: 'On the body for',
      value: `${formatDuration(now - Date.parse(device.wearStartedAt))} (since ${formatDateTime(device.wearStartedAt)})`,
    });
  } else if (device.lastWear) {
    const { startedAt, endedAt } = device.lastWear;
    rows.push({
      label: 'Last worn',
      value: `${formatDuration(Date.parse(endedAt) - Date.parse(startedAt))}, removed ${formatDateTime(endedAt)}`,
    });
  }

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: phase === 'off' ? theme.border : phaseColor[phase] }]}>
      <View style={styles.titleRow}>
        <ThemedText type="heading">Sensor patch</ThemedText>
        <View style={[styles.pill, { borderColor: phaseColor[phase] }]}>
          <View style={[styles.dot, { backgroundColor: phaseColor[phase] }]} />
          <ThemedText style={[styles.pillText, { color: phaseColor[phase] }]}>
            {PHASE_LABELS[phase]}
          </ThemedText>
        </View>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {message}
      </ThemedText>

      {rows.length > 0 && (
        <View style={[styles.rows, { borderTopColor: theme.backgroundSelected }]}>
          {rows.map(({ label, value, color }) => (
            <View key={label} style={styles.row}>
              <ThemedText type="small" themeColor="textSecondary">
                {label}
              </ThemedText>
              <ThemedText type="smallBold" style={[styles.value, color ? { color } : null]}>
                {value}
              </ThemedText>
            </View>
          ))}
        </View>
      )}

      {phase === 'off' && (
        <Button
          title="Activate sensors"
          loading={busy === 'activate'}
          onPress={() => run('activate', onActivate)}
        />
      )}
      {phase === 'ready' && (
        <Button
          title="Scan initial readings"
          loading={busy === 'scan'}
          onPress={() => run('scan', onScan)}
        />
      )}
      {phase === 'monitoring' && (
        <Button
          title="Rescan initial readings"
          variant="secondary"
          loading={busy === 'scan'}
          onPress={() => run('scan', onScan)}
        />
      )}
      {phase !== 'off' && (
        <Button
          title={phase === 'activating' ? 'Cancel' : 'Deactivate sensors'}
          variant="secondary"
          color={theme.danger}
          loading={busy === 'deactivate'}
          onPress={() => run('deactivate', onDeactivate)}
        />
      )}

      {error && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: 12,
    borderWidth: 2,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingHorizontal: 10,
    paddingVertical: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  rows: {
    gap: Spacing.two,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
