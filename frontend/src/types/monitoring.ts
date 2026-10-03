import type { PatchPosition } from '@/constants/positions';
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
 * The initial scan. `none`: not scanned yet; `waiting`: the next reading from the device starts
 * the minute; `running`: averaging readings; `complete`: readings are scored against `baseline`.
 */
export type CalibrationStatus = 'none' | 'waiting' | 'running' | 'complete';

export interface Calibration {
  status: CalibrationStatus;
  durationSeconds: number;
  startedAt: string | null;
  endsAt: string | null;
  /** Readings averaged so far. */
  samples: number;
  baseline: Baseline | null;
}

/** The sensor patch, as set from the app and as last reported by the ESP32. */
export interface DeviceStatus {
  /** Activated in the app. */
  active: boolean;
  activatedAt: string | null;
  /** The patient's usual position chosen when activating, and the patch site it calls for. */
  position?: PatchPosition | null;
  site?: string | null;
  /** The ESP32 reported its sensors on. */
  deviceActive: boolean;
  /** The sensors gave a valid reading; null when unknown. */
  sensorsOk: boolean | null;
  /** When the ESP32 last checked in. */
  lastSeenAt: string | null;
  /** When the patch went on the body (its initial scan); null when not worn. */
  wearStartedAt: string | null;
  /** The previous wear session. */
  lastWear: { startedAt: string; endedAt: string } | null;
}

/** The patch and its initial scan, sent whenever either changes. */
export interface PatchStatus {
  device: DeviceStatus;
  calibration: Calibration;
}

/** The latest reading from the patient's ESP32, as scored by the backend. */
export interface Snapshot {
  deviceId: string;
  reading: SensorData;
  /** When the backend received the reading (ISO 8601). */
  receivedAt: string;
  /** Seconds pressure has stayed elevated above the baseline. */
  pressureDuration: number;
  /** Null until the initial scan has set the baseline. */
  risk: Risk | null;
  calibration: Calibration;
  device: DeviceStatus;
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
