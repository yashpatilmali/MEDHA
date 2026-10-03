import type { PatchPosition } from '@/constants/positions';
import type { SensorData } from '@/types/sensor';

/** NORMAL, or ATTENTION when any rule against the patient's baseline is met. */
export type RiskLevel = 'NORMAL' | 'ATTENTION';

/** Which rules put a reading in ATTENTION. */
export interface Triggers {
  /** ≥ 32 mmHg held for ≥ 10 s. */
  pressure: boolean;
  /** ≥ 20 % above the baseline, relative to it. */
  temperature: boolean;
  /** ≥ 50 % above the baseline, relative to it. */
  humidity: boolean;
}

/** The backend's check of one reading against the patient's baseline. */
export interface Risk {
  riskLevel: RiskLevel;
  /** True while ATTENTION. */
  immediateAlert: boolean;
  triggers: Triggers;
  /** Change from the baseline, in each sensor's unit. */
  deltas: SensorData;
  /** Change from the baseline in %; null when the baseline is 0. */
  percentChanges: { pressure: number | null; temperature: number | null; humidity: number | null };
  /** The patient's personal equivalent of 32 mmHg, as a % rise from their baseline pressure. */
  pressureAttentionPercent: number | null;
  thresholds: {
    pressure: number;
    durationSeconds: number;
    temperatureRisePercent: number;
    humidityRisePercent: number;
  };
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
  /** Seconds pressure has stayed at or above 32 mmHg. */
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
  /** Null on alerts recorded before the two-state rules. */
  triggers: Triggers | null;
}

export interface HistoryPoint extends SensorData {
  at: string;
  /** Missing for readings taken before the initial scan finished. */
  riskLevel?: RiskLevel;
}
