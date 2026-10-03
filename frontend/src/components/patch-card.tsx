import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PATCH_POSITIONS, type PatchPosition } from '@/constants/positions';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PatchStatus } from '@/types/monitoring';
import { formatAgo, formatDateTime, formatDuration } from '@/utils/format';
import { activationOverdue, patchPhase, type PatchPhase } from '@/utils/patch';

type PatchCardProps = {
  status: PatchStatus;
  now: number;
  onActivate: () => Promise<void>;
  onChoosePosition: (position: PatchPosition) => Promise<void>;
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

type Action = 'activate' | 'position' | 'scan' | 'deactivate';

/**
 * Controls the sensor patch: activate its sensors, then ask the patient's position and say where
 * to place the patch, scan the initial readings, deactivate. Shows whether the patch has confirmed
 * it is on, where it is, and how long it has been on the body.
 */
export function PatchCard({
  status,
  now,
  onActivate,
  onChoosePosition,
  onScan,
  onDeactivate,
}: PatchCardProps) {
  const theme = useTheme();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The answer being picked, before it is confirmed with "Patch placed".
  const [position, setPosition] = useState<PatchPosition | null>(null);
  const [changingPosition, setChangingPosition] = useState(false);
  // Deactivating ends monitoring, so it asks for confirmation first.
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const chosen = PATCH_POSITIONS.find((option) => option.value === position);

  const { device, calibration } = status;
  const phase = patchPhase(device, calibration, now);
  // Deactivated from somewhere else (another phone, or the patch timing out): close the prompt.
  if (phase === 'off' && confirmingDeactivate) setConfirmingDeactivate(false);
  // Each new patch is asked its position afresh.
  if (phase === 'off' && (position !== null || changingPosition)) {
    setPosition(null);
    setChangingPosition(false);
  }

  const savedPosition = device.position ?? null;
  // Asked once the sensors are on, before the initial scan.
  const askPosition = phase === 'ready' && (savedPosition === null || changingPosition);

  async function run(action: Action, task: () => Promise<void>) {
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
      message = "Activate the sensors. The app then asks the patient's position and shows where to place the patch.";
      break;
    case 'activating':
      message = activationOverdue(device, now)
        ? "The patch hasn't responded. Check it is switched on and connected to Wi-Fi."
        : 'Waiting for the patch to switch its sensors on...';
      break;
    case 'ready':
      message = askPosition
        ? 'Sensors are on. Answer the question below to see where to place the patch.'
        : `Patch placed on the ${device.site?.toLowerCase() ?? 'patient'}. Keep the patient still, then scan the initial readings to set their baseline.`;
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
  if (device.active && device.site) {
    rows.push({ label: 'Patch site', value: device.site });
  }
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
      {askPosition && (
        <View style={styles.question}>
          <ThemedText type="smallBold">What best describes the patient&apos;s current position?</ThemedText>
          <View role="radiogroup" aria-label="Patient's current position" style={styles.options}>
            {PATCH_POSITIONS.map((option) => {
              const selected = option.value === position;
              return (
                <Pressable
                  key={option.value}
                  role="radio"
                  aria-checked={selected}
                  onPress={() => setPosition(option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      borderColor: selected ? theme.tint : theme.backgroundSelected,
                      backgroundColor: selected ? theme.primarySoft : theme.backgroundElement,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.radio, { borderColor: selected ? theme.tint : theme.textSecondary }]}>
                    {selected && <View style={[styles.radioDot, { backgroundColor: theme.tint }]} />}
                  </View>
                  <ThemedText type={selected ? 'smallBold' : 'small'} style={styles.optionLabel}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {chosen && (
            <View style={[styles.placement, { borderLeftColor: theme.tint, backgroundColor: theme.primarySoft }]}>
              <ThemedText type="overline" style={{ color: theme.tint }}>
                Place the patch here
              </ThemedText>
              <ThemedText type="heading">{chosen.site}</ThemedText>
              <ThemedText type="small">{chosen.instruction}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Press firmly so the whole sensor touches the skin.
              </ThemedText>
            </View>
          )}

          {chosen && (
            <Button
              title="Patch placed: continue"
              loading={busy === 'position'}
              onPress={() =>
                run('position', async () => {
                  await onChoosePosition(chosen.value);
                  setChangingPosition(false);
                })
              }
            />
          )}
          {changingPosition && (
            <Button
              title="Keep current position"
              variant="secondary"
              onPress={() => setChangingPosition(false)}
            />
          )}
        </View>
      )}
      {phase === 'ready' && !askPosition && (
        <>
          <Button
            title="Scan initial readings"
            loading={busy === 'scan'}
            onPress={() => run('scan', onScan)}
          />
          <Button
            title="Change position"
            variant="secondary"
            onPress={() => {
              setPosition(savedPosition);
              setChangingPosition(true);
            }}
          />
        </>
      )}
      {phase === 'monitoring' && (
        <Button
          title="Rescan initial readings"
          variant="secondary"
          loading={busy === 'scan'}
          onPress={() => run('scan', onScan)}
        />
      )}
      {phase === 'activating' && (
        <Button
          title="Cancel activation"
          variant="secondary"
          color={theme.danger}
          loading={busy === 'deactivate'}
          onPress={() => run('deactivate', onDeactivate)}
        />
      )}
      {phase !== 'off' && phase !== 'activating' && !confirmingDeactivate && (
        <Button
          title="Deactivate patch"
          variant="secondary"
          color={theme.danger}
          onPress={() => setConfirmingDeactivate(true)}
        />
      )}
      {phase !== 'off' && phase !== 'activating' && confirmingDeactivate && (
        <View
          role="alert"
          style={[
            styles.confirm,
            { backgroundColor: theme.alertBackground, borderColor: theme.alertBorder },
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.alertText }}>
            Deactivate the patch?
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.alertText }}>
            The sensors switch off and monitoring stops: no more alerts or caretaker SMS.
            {device.wearStartedAt
              ? ` The wear session (${formatDuration(now - Date.parse(device.wearStartedAt))}) ends,`
              : ''}{' '}
            and the next patch needs a new initial scan. Remove the patch from the patient after
            deactivating.
          </ThemedText>
          <Button
            title="Yes, deactivate patch"
            color={theme.onTint}
            loading={busy === 'deactivate'}
            onPress={() =>
              run('deactivate', async () => {
                await onDeactivate();
                setConfirmingDeactivate(false);
              })
            }
          />
          <Button
            title="Keep monitoring"
            variant="secondary"
            onPress={() => setConfirmingDeactivate(false)}
          />
        </View>
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
  question: {
    gap: 12,
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pressed: {
    opacity: 0.7,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionLabel: {
    flexShrink: 1,
  },
  confirm: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  placement: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
