import type {
  AlertEvent,
  Baseline,
  Calibration,
  PatchStatus,
  RiskLevel,
  Snapshot,
} from '@/types/monitoring';
import type { Patient } from '@/types/patient';

export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE !== 'false';
export const DEMO_TOKEN = 'medha-demo-token';

export const DEMO_PATIENT: Patient = {
  id: 'SP-DEMO-001',
  name: 'Anita Sharma',
  age: 68,
  sex: 'Female',
  contact: 'demo@medha.health',
  deviceId: 'SP-ESP32-DEMO',
  caretaker: { name: 'Rohan Sharma', phone: '+919876500000' },
  createdAt: '2026-01-15T09:30:00.000Z',
};

export const DEMO_ALERTS: AlertEvent[] = [
  {
    id: 'demo-alert-1',
    at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    deviceId: DEMO_PATIENT.deviceId,
    pressure: 40.2,
    temperature: 35.1,
    humidity: 52,
    pressureDuration: 60,
    riskScore: 10,
  },
];

const DEMO_CALIBRATION_SECONDS = 60;

/** How long the pretend patch takes to confirm activation. */
const DEMO_CONFIRM_MS = 2000;

const DEMO_BASELINE = { pressure: 12, temperature: 33, humidity: 45 };

/** What has been pressed in demo mode, as timestamps. */
export type DemoSession = {
  /** Null when the sensors are off. */
  activatedAt: number | null;
  scanStartedAt: number | null;
  wearStartedAt: number | null;
  lastWear: { startedAt: number; endedAt: number } | null;
};

export const DEMO_SESSION_OFF: DemoSession = {
  activatedAt: null,
  scanStartedAt: null,
  wearStartedAt: null,
  lastWear: null,
};

const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString());
const tier = (value: number, first: number, second: number) =>
  value >= second ? 2 : value >= first ? 1 : 0;
const round = (value: number) => Number(value.toFixed(1));

function demoCalibration(now: number, scanStartedAt: number | null): Calibration {
  const durationSeconds = DEMO_CALIBRATION_SECONDS;
  const none = { durationSeconds, startedAt: null, endsAt: null, samples: 0, baseline: null };
  if (scanStartedAt === null) return { status: 'none', ...none };

  const endsAt = scanStartedAt + durationSeconds * 1000;
  if (now < endsAt) {
    return {
      status: 'running',
      durationSeconds,
      startedAt: iso(scanStartedAt),
      endsAt: iso(endsAt),
      samples: Math.floor((now - scanStartedAt) / 2500) + 1,
      baseline: null,
    };
  }
  const baseline: Baseline = { ...DEMO_BASELINE, samples: 24, calibratedAt: iso(endsAt)! };
  return { status: 'complete', ...none, baseline };
}

/** The pretend patch's status in demo mode, like the backend's. */
export function demoStatus(now: number, session: DemoSession): PatchStatus {
  const { activatedAt } = session;
  const confirmed = activatedAt !== null && now - activatedAt >= DEMO_CONFIRM_MS;
  return {
    device: {
      active: activatedAt !== null,
      activatedAt: iso(activatedAt),
      deviceActive: confirmed,
      sensorsOk: confirmed ? true : null,
      lastSeenAt: confirmed ? iso(now) : null,
      wearStartedAt: iso(session.wearStartedAt),
      lastWear: session.lastWear && {
        startedAt: iso(session.lastWear.startedAt)!,
        endedAt: iso(session.lastWear.endedAt)!,
      },
    },
    calibration: demoCalibration(now, session.scanStartedAt),
  };
}

/** A made-up reading for demo mode, or null while the pretend patch's sensors are off. */
export function demoSnapshot(now: number, session: DemoSession): Snapshot | null {
  const { device, calibration } = demoStatus(now, session);
  if (!device.deviceActive) return null;

  const wave = Math.sin(now / 9000);
  const pressure = round(26 + wave * 8);
  const temperature = round(33.6 + wave * 0.6);
  const humidity = round(48 + wave * 4);
  const base = {
    deviceId: DEMO_PATIENT.deviceId,
    reading: { pressure, temperature, humidity },
    receivedAt: new Date(now).toISOString(),
    pressureDuration: 0,
    calibration,
    device,
  };
  if (calibration.status !== 'complete') return { ...base, risk: null };

  const deltas = {
    pressure: round(pressure - DEMO_BASELINE.pressure),
    temperature: round(temperature - DEMO_BASELINE.temperature),
    humidity: round(humidity - DEMO_BASELINE.humidity),
  };
  const weights = { pressure: 2, temperature: 2, humidity: 1, duration: 2 };
  const pressureScore = tier(deltas.pressure, 10, 25);
  const temperatureScore = tier(deltas.temperature, 1, 2);
  const humidityScore = tier(deltas.humidity, 10, 20);
  const riskScore =
    weights.pressure * pressureScore +
    weights.temperature * temperatureScore +
    weights.humidity * humidityScore;
  const riskLevel: RiskLevel =
    riskScore <= 3 ? 'NORMAL' : riskScore <= 7 ? 'ATTENTION' : 'CRITICAL';

  return {
    ...base,
    risk: {
      pressureScore,
      temperatureScore,
      humidityScore,
      durationScore: 0,
      riskScore,
      riskLevel,
      immediateAlert: riskLevel === 'CRITICAL',
      deltas,
      maxScore: 14,
      weights,
    },
  };
}
