import type { AlertEvent, Baseline, Calibration, RiskLevel, Snapshot } from '@/types/monitoring';
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

const DEMO_BASELINE: Baseline = {
  pressure: 12,
  temperature: 33,
  humidity: 45,
  samples: 30,
  calibratedAt: '2026-01-15T09:31:00.000Z',
};

const tier = (value: number, first: number, second: number) =>
  value >= second ? 2 : value >= first ? 1 : 0;
const round = (value: number) => Number(value.toFixed(1));

/**
 * A made-up reading for demo mode. While `calibrationStartedAt` is less than a minute ago the
 * baseline is being calibrated, as on the real backend.
 */
export function demoSnapshot(now = Date.now(), calibrationStartedAt: number | null = null): Snapshot {
  const wave = Math.sin(now / 9000);
  const pressure = round(26 + wave * 8);
  const temperature = round(33.6 + wave * 0.6);
  const humidity = round(48 + wave * 4);
  const reading = { pressure, temperature, humidity };
  const base = {
    deviceId: DEMO_PATIENT.deviceId,
    reading,
    receivedAt: new Date(now).toISOString(),
    pressureDuration: 0,
  };

  const calibrating =
    calibrationStartedAt !== null && now - calibrationStartedAt < DEMO_CALIBRATION_SECONDS * 1000;
  if (calibrating) {
    const calibration: Calibration = {
      status: 'running',
      durationSeconds: DEMO_CALIBRATION_SECONDS,
      startedAt: new Date(calibrationStartedAt).toISOString(),
      endsAt: new Date(calibrationStartedAt + DEMO_CALIBRATION_SECONDS * 1000).toISOString(),
      samples: Math.floor((now - calibrationStartedAt) / 2500) + 1,
      baseline: null,
    };
    return { ...base, risk: null, calibration };
  }

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
    calibration: {
      status: 'complete',
      durationSeconds: DEMO_CALIBRATION_SECONDS,
      startedAt: null,
      endsAt: null,
      samples: 0,
      baseline:
        calibrationStartedAt === null
          ? DEMO_BASELINE
          : {
              ...DEMO_BASELINE,
              calibratedAt: new Date(
                calibrationStartedAt + DEMO_CALIBRATION_SECONDS * 1000
              ).toISOString(),
            },
    },
  };
}
