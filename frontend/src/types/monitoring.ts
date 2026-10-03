import type { SensorData } from '@/types/sensor';

export type RiskLevel = 'NORMAL' | 'ATTENTION' | 'CRITICAL';
export const MAX_RISK_SCORE = 14;

/** The backend's scoring of one reading against the patient's baseline. */
export interface Risk {
  pressureScore: number;
  temperatureScore: number;
  humidityScore: number;
  durationScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  /** True while CRITICAL. */
  immediateAlert: boolean;
  /** How far each value is above (or, if negative, below) the baseline. */
  deltas: SensorData;
  /** Highest possible riskScore. */
  maxScore: number;
  /** How much each score counts towards riskScore. */
  weights: { pressure: number; temperature: number; humidity: number; duration: number };
}

/** The patient's normal values: the average of the 1-minute calibration. */
export interface Baseline extends SensorData {
  samples: number;
  calibratedAt: string;
}

/**
 * `waiting`: the next reading from the device starts the minute; `running`: averaging readings;
 * `complete`: readings are scored against `baseline`.
 */
export type CalibrationStatus = 'waiting' | 'running' | 'complete';

export interface Calibration {
  status: CalibrationStatus;
  durationSeconds: number;
  startedAt: string | null;
  endsAt: string | null;
  /** Readings averaged so far. */
  samples: number;
  baseline: Baseline | null;
}

/** The latest reading from the patient's ESP32, as scored by the backend. */
export interface Snapshot {
  deviceId: string;
  reading: SensorData;
  /** When the backend received the reading (ISO 8601). */
  receivedAt: string;
  /** Seconds pressure has stayed elevated above the baseline. */
  pressureDuration: number;
  /** Null while the baseline is being calibrated. */
  risk: Risk | null;
  calibration: Calibration;
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
  /** Missing for readings taken while calibrating. */
  riskScore?: number;
  riskLevel?: RiskLevel;
}
