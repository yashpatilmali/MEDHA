import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PressureAlert } from '@/components/pressure-alert';
import { RiskBreakdown } from '@/components/risk-breakdown';
import { ScreenTitle } from '@/components/screen-title';
import { SensorCard } from '@/components/sensor-card';
import { SparshMark } from '@/components/sparsh-logo';
import { TabScreen } from '@/components/tab-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { APP_NAME, APP_TAGLINE } from '@/constants/brand';
import { PRESSURE_UNIT } from '@/constants/monitor';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { useLiveMonitoring, type Connection } from '@/hooks/use-live-monitoring';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import type { Patient } from '@/types/patient';
import { MAX_RISK_SCORE, type RiskLevel } from '@/types/monitoring';

const RISK_MESSAGES: Record<RiskLevel, string> = {
  NORMAL: 'Continue monitoring',
  ATTENTION: 'Watch the pressure zone',
  'HIGH RISK': 'Check / reposition patient',
};

const STATUS_LABELS: Record<Connection, string> = {
  connecting: 'CONNECTING',
  connected: 'CONNECTED',
  disconnected: 'OFFLINE',
};

function formatAgo(seconds: number) {
  if (seconds < 1) return 'just now';
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}

export default function DashboardScreen() {
  const { patient, token } = useSession();
  // Briefly null while logging out, before the tabs unmount.
  if (!patient) return null;
  return token ? <Dashboard patient={patient} token={token} /> : null;
}

function Dashboard({ patient, token }: { patient: Patient; token: string }) {
  const theme = useTheme();
  const now = useNow();
  const feed = useLiveMonitoring(token);
  const reading = feed.snapshot?.reading ?? null;
  const risk = feed.snapshot?.risk ?? null;
  const pressureDuration = feed.snapshot?.pressureDuration ?? 0;
  const secondsSinceUpdate = feed.snapshot
    ? Math.max(0, Math.floor((now - Date.parse(feed.snapshot.receivedAt)) / 1000))
    : null;

  const riskColor: Record<RiskLevel, string> = {
    NORMAL: theme.normal,
    ATTENTION: theme.attention,
    'HIGH RISK': theme.danger,
  };
  const statusColor: Record<Connection, string> = {
    connecting: theme.textSecondary,
    connected: theme.normal,
    disconnected: theme.danger,
  };

  return (
    <TabScreen>
      <ScreenTitle title="Dashboard" />

      <View style={styles.header}>
        <View style={styles.brand}>
          <SparshMark size={36} color={theme.tint} />
          <View style={styles.shrink}>
            <ThemedText style={styles.logo}>{APP_NAME}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {APP_TAGLINE}
            </ThemedText>
          </View>
        </View>
        <ThemedView type="backgroundElement" style={styles.connection}>
          <View style={[styles.dot, { backgroundColor: statusColor[feed.connection] }]} />
          <ThemedText style={styles.connectionText}>{STATUS_LABELS[feed.connection]}</ThemedText>
        </ThemedView>
      </View>

      <ThemedView type="backgroundElement" style={[styles.patientCard, { borderColor: theme.border }]}>
        <View>
          <ThemedText themeColor="textSecondary" style={styles.label}>
            PATIENT
          </ThemedText>
          <ThemedText style={styles.patientName}>{patient.name}</ThemedText>
        </View>
        <View style={[styles.patientDetails, { borderTopColor: theme.backgroundSelected }]}>
          <PatientDetail label="PATIENT ID" value={patient.id} />
          <PatientDetail label="AGE" value={String(patient.age)} />
          <PatientDetail label="SEX" value={patient.sex} />
          <PatientDetail label="DEVICE" value={patient.deviceId} />
        </View>
      </ThemedView>

      {reading && risk ? (
        <>
          {feed.connection === 'disconnected' && (
            <ThemedView
              type="backgroundElement"
              style={[styles.notice, { borderLeftColor: theme.attention }]}>
              <ThemedText type="smallBold" style={{ color: theme.attention }}>
                Connection lost
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Showing the last reading, received {formatAgo(secondsSinceUpdate ?? 0)}.
              </ThemedText>
            </ThemedView>
          )}

          {risk.immediateAlert && <PressureAlert reading={reading} duration={pressureDuration} />}

          <ThemedView
            type="backgroundElement"
            style={[styles.riskCard, { borderColor: riskColor[risk.riskLevel] }]}>
            <ThemedText themeColor="textSecondary" style={styles.label}>
              CURRENT RISK
            </ThemedText>
            <View style={styles.scoreRow}>
              <ThemedText style={styles.score}>{risk.riskScore}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.scoreMax}>
                / {MAX_RISK_SCORE}
              </ThemedText>
            </View>
            <ThemedText style={[styles.riskLevel, { color: riskColor[risk.riskLevel] }]}>
              {risk.riskLevel}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {RISK_MESSAGES[risk.riskLevel]}
            </ThemedText>
          </ThemedView>

          <View style={styles.grid}>
            <SensorCard
              title="PRESSURE"
              value={reading.pressure.toFixed(1)}
              unit={PRESSURE_UNIT}
              status={risk.pressureScore >= 2 ? 'Elevated' : 'Normal'}
              statusColor={risk.pressureScore >= 2 ? theme.danger : theme.normal}
            />
            <SensorCard
              title="TEMPERATURE"
              value={reading.temperature.toFixed(1)}
              unit="deg C"
              status={risk.temperatureScore === 2 ? 'Elevated' : 'Normal'}
              statusColor={risk.temperatureScore === 2 ? theme.danger : theme.normal}
            />
            <SensorCard
              title="HUMIDITY"
              value={reading.humidity.toFixed(1)}
              unit="%RH"
              status={risk.humidityScore === 0 ? 'Normal' : 'Abnormal'}
              statusColor={risk.humidityScore === 0 ? theme.normal : theme.attention}
            />
            <SensorCard
              title="PRESSURE DURATION"
              value={String(pressureDuration)}
              unit="sec"
              status={risk.durationScore >= 1 ? 'Sustained' : 'Monitoring'}
              statusColor={risk.durationScore >= 1 ? theme.danger : theme.normal}
            />
          </View>

          <RiskBreakdown risk={risk} />
        </>
      ) : (
        <ThemedView type="backgroundElement" style={[styles.waitingCard, { borderColor: theme.border }]}>
          <ActivityIndicator color={theme.textSecondary} />
          <ThemedText type="smallBold">
            {feed.connection === 'disconnected'
              ? "Can't reach the monitoring server"
              : 'Connecting to monitoring...'}
          </ThemedText>
          <ThemedText type="code" themeColor="textSecondary">
            {patient.deviceId}
          </ThemedText>
        </ThemedView>
      )}

      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          Last update:{' '}
          {secondsSinceUpdate === null ? 'waiting for first reading' : formatAgo(secondsSinceUpdate)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {feed.connection === 'connected'
            ? 'Live updates from your monitoring device'
            : 'Waiting for live device data'}
        </ThemedText>
      </View>
    </TabScreen>
  );
}

function PatientDetail({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <ThemedText themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  shrink: {
    flexShrink: 1,
  },
  logo: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: 800,
    letterSpacing: 0.5,
  },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  connectionText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  patientCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: 700,
    letterSpacing: 1,
  },
  patientName: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: 700,
  },
  patientDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.four,
    rowGap: Spacing.two,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  notice: {
    borderLeftWidth: 4,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  riskCard: {
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  score: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: 800,
  },
  scoreMax: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 600,
  },
  riskLevel: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 800,
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  waitingCard: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
  },
  centerText: {
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.half,
  },
});
