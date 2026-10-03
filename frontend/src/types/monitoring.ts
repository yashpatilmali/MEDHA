import type { SensorData } from '@/types/sensor';

export type RiskLevel = 'NORMAL' | 'ATTENTION' | 'HIGH RISK';
export const MAX_RISK_SCORE = 14;

/** The backend's risk scoring for one reading. */
export interface Risk {
  pressureScore: number;
  temperatureScore: number;
  humidityScore: number;
  durationScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  immediateAlert: boolean;
  /** Highest possible riskScore. */
  maxScore: number;
  /** How much each score counts towards riskScore. */
  weights: { pressure: number; temperature: number; humidity: number; duration: number };
}

/** The latest reading from the patient's ESP32, as scored by the backend. */
export interface Snapshot {
  deviceId: string;
  reading: SensorData;
  /** When the backend received the reading (ISO 8601). */
  receivedAt: string;
  /** Seconds pressure has stayed at or above the alert level. */
  pressureDuration: number;
  risk: Risk;
}

export interface AlertEvent extends SensorData {
  id: string;
  at: string;
  deviceId: string;
  pressureDuration: number;
  riskScore: number;
}

export interface HistoryPoint extends SensorData {
  at: string;
  riskScore: number;
  riskLevel: RiskLevel;
}
