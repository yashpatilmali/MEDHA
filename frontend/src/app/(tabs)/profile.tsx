import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ScreenTitle } from '@/components/screen-title';
import { TabScreen } from '@/components/tab-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PRESSURE_UNIT } from '@/constants/monitor';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/api/client';
import { DEMO_ALERTS, DEMO_MODE } from '@/constants/demo';
import type { AlertEvent } from '@/types/monitoring';
import { isEmail } from '@/utils/contact';
import { formatDate, formatDateTime, initials } from '@/utils/format';
import type { Patient } from '@/types/patient';

const RECENT_ALERTS = 5;

/** What turned the status ATTENTION, e.g. "Pressure + temperature". */
function alertReason(alert: AlertEvent) {
  if (!alert.triggers) return 'Alert';
  const reasons = [
    alert.triggers.pressure && 'pressure',
    alert.triggers.temperature && 'temperature',
    alert.triggers.humidity && 'humidity',
  ].filter(Boolean);
  const text = reasons.join(' + ') || 'alert';
  return text[0].toUpperCase() + text.slice(1);
}

export default function ProfileScreen() {
  const { patient, signOut } = useSession();
  // Briefly null while logging out, before the tabs unmount.
  if (!patient) return null;
  return <Profile patient={patient} onSignOut={signOut} />;
}

function Profile({ patient, onSignOut }: { patient: Patient; onSignOut: () => Promise<void> }) {
  const theme = useTheme();
  const [alerts, setAlerts] = useState<AlertEvent[] | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Reload each time the tab is opened, so alerts recorded on the dashboard show up.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (DEMO_MODE ? Promise.resolve({ alerts: DEMO_ALERTS }) : api.alerts(RECENT_ALERTS))
        .then(({ alerts }) => {
          if (active) setAlerts(alerts);
        })
        .catch((error) => console.warn('Could not load alerts:', error));
      return () => {
        active = false;
      };
    }, [])
  );

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await onSignOut();
    } catch (error) {
      console.warn('Could not log out:', error);
      setSigningOut(false);
    }
  }

  const details = [
    { label: 'Patient ID', value: patient.id },
    { label: 'Patient Name', value: patient.name },
    { label: 'Age', value: String(patient.age) },
    { label: 'Sex', value: patient.sex },
    { label: isEmail(patient.contact) ? 'Email' : 'Mobile Number', value: patient.contact },
    { label: 'Registered Device ID', value: patient.deviceId },
    // `?.`: a session saved by an older app version has no caretaker field.
    { label: 'Caretaker', value: patient.caretaker?.name ?? 'Not added' },
    { label: 'Caretaker Mobile (SMS alerts)', value: patient.caretaker?.phone ?? '-' },
    { label: 'Account Created', value: formatDate(patient.createdAt) },
  ];
  const divider = { borderTopColor: theme.backgroundSelected };

  return (
    <TabScreen>
      <ScreenTitle title="Profile" />

      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
          <ThemedText style={[styles.initials, { color: theme.onTint }]}>
            {initials(patient.name)}
          </ThemedText>
        </View>
        <ThemedText style={styles.name}>{patient.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Patient ID {patient.id}
        </ThemedText>
      </View>

      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        {details.map(({ label, value }, index) => (
          <View key={label} style={[styles.row, index > 0 && [styles.divider, divider]]}>
            <ThemedText type="small" themeColor="textSecondary">
              {label}
            </ThemedText>
            <ThemedText type="smallBold" style={styles.value}>
              {value}
            </ThemedText>
          </View>
        ))}
      </ThemedView>

      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
        <View style={styles.row}>
          <ThemedText type="smallBold">Attention alerts</ThemedText>
          {alerts && (
            <ThemedText type="small" themeColor="textSecondary">
              {alerts.length} recorded
            </ThemedText>
          )}
        </View>

        {alerts === null ? (
          <ActivityIndicator color={theme.textSecondary} style={styles.loading} />
        ) : alerts.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            No attention alerts recorded for {patient.id} yet.
          </ThemedText>
        ) : (
          alerts.slice(0, RECENT_ALERTS).map((alert) => (
            <View key={alert.at} style={[styles.row, styles.divider, divider]}>
              <ThemedText type="small">{formatDateTime(alert.at)}</ThemedText>
              <ThemedText type="smallBold" style={[styles.value, { color: theme.attention }]}>
                {alertReason(alert)} | {alert.pressure.toFixed(1)} {PRESSURE_UNIT}
              </ThemedText>
            </View>
          ))
        )}
      </ThemedView>

      <Button
        title="Log Out"
        variant="secondary"
        color={theme.danger}
        loading={signingOut}
        onPress={handleSignOut}
      />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  initials: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: 700,
  },
  name: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
    textAlign: 'center',
  },
  card: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 12,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
  loading: {
    paddingVertical: Spacing.three,
  },
  empty: {
    paddingBottom: 12,
  },
});
