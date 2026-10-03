import type { AlertEvent, Baseline, Calibration, PatchStatus, Snapshot } from '@/types/monitoring';
import { PATCH_POSITIONS, type PatchPosition } from '@/constants/positions';
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
    pressure: 36.2,
    temperature: 33.4,
    humidity: 48,
    pressureDuration: 10,
    triggers: { pressure: true, temperature: false, humidity: false },
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
  position: PatchPosition | null;
  scanStartedAt: number | null;
  wearStartedAt: number | null;
  lastWear: { startedAt: number; endedAt: number } | null;
};

export const DEMO_SESSION_OFF: DemoSession = {
  activatedAt: null,
  position: null,
  scanStartedAt: null,
  wearStartedAt: null,
  lastWear: null,
};

const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString());
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
      position: session.position,
      site: PATCH_POSITIONS.find((option) => option.value === session.position)?.site ?? null,
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

  // One cycle about every 57 s; pressure is over 32 mmHg for about 15 s of it.
  const phase = (now / 9000) % (2 * Math.PI);
  const wave = Math.sin(phase);
  const pressure = round(26 + wave * 9);
  const temperature = round(33.1 + wave * 0.15);
  const humidity = round(46 + wave * 3);
  const base = {
    deviceId: DEMO_PATIENT.deviceId,
    reading: { pressure, temperature, humidity },
    receivedAt: new Date(now).toISOString(),
    pressureDuration: 0,
    calibration,
    device,
  };
  if (calibration.status !== 'complete') return { ...base, risk: null };

  // The same rules as the backend: 32 mmHg held 10 s, +20 % temperature, +50 % humidity.
  const overFrom = Math.asin((32 - 26) / 9);
  const pressureDuration = pressure >= 32 ? Math.max(0, Math.floor(((phase - overFrom) * 9000) / 1000)) : 0;
  const percent = (value: number, baseline: number) => round(((value - baseline) / baseline) * 100);
  const humidityPercent = round(((humidity - DEMO_BASELINE.humidity) / DEMO_BASELINE.humidity) * 100);
  const triggers = {
    pressure: pressure >= 32 && pressureDuration >= 10,
    temperature: percent(temperature, DEMO_BASELINE.temperature) >= 20,
    humidity: humidityPercent >= 50,
  };
  const attention = triggers.pressure || triggers.temperature || triggers.humidity;

  return {
    ...base,
    pressureDuration,
    risk: {
      riskLevel: attention ? 'ATTENTION' : 'NORMAL',
      immediateAlert: attention,
      triggers,
      deltas: {
        pressure: round(pressure - DEMO_BASELINE.pressure),
        temperature: round(temperature - DEMO_BASELINE.temperature),
        humidity: round(humidity - DEMO_BASELINE.humidity),
      },
      percentChanges: {
        pressure: percent(pressure, DEMO_BASELINE.pressure),
        temperature: percent(temperature, DEMO_BASELINE.temperature),
        humidity: humidityPercent,
      },
      pressureAttentionPercent: percent(32, DEMO_BASELINE.pressure),
      thresholds: { pressure: 32, durationSeconds: 10, temperatureRisePercent: 20, humidityRisePercent: 50 },
    },
  };
}
