import type { AlertEvent, Snapshot } from '@/types/monitoring';
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
  createdAt: '2026-01-15T09:30:00.000Z',
};

export const DEMO_ALERTS: AlertEvent[] = [
  {
    id: 'demo-alert-1',
    at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    deviceId: DEMO_PATIENT.deviceId,
    pressure: 34.2,
    temperature: 37.1,
    humidity: 39,
    pressureDuration: 18,
    riskScore: 9,
  },
];

export function demoSnapshot(now = Date.now()): Snapshot {
  const wave = Math.sin(now / 9000);
  const pressure = Number((29.5 + wave * 2.2).toFixed(1));
  const temperature = Number((36.6 + wave * 0.2).toFixed(1));
  const humidity = Number((34 + wave * 2).toFixed(1));

  return {
    deviceId: DEMO_PATIENT.deviceId,
    reading: { pressure, temperature, humidity },
    receivedAt: new Date(now).toISOString(),
    pressureDuration: 0,
    risk: {
      pressureScore: pressure >= 32 ? 2 : pressure >= 25 ? 1 : 0,
      temperatureScore: temperature >= 37 ? 2 : temperature >= 36 ? 1 : 0,
      humidityScore: 0,
      durationScore: 0,
      riskScore: 4,
      riskLevel: 'ATTENTION',
      immediateAlert: false,
      maxScore: 14,
      weights: { pressure: 2, temperature: 1, humidity: 1, duration: 2 },
    },
  };
}