import { ACTIVATION_TIMEOUT_SECONDS, DEVICE_STALE_SECONDS } from '@/constants/monitor';
import type { Calibration, DeviceStatus } from '@/types/monitoring';

/**
 * Where the patch is in its life cycle:
 *   off → (Activate) → activating → ready → (Scan initial readings) → scanning → monitoring
 * `offline`: activated and confirmed, but it has stopped checking in.
 */
export type PatchPhase = 'off' | 'activating' | 'ready' | 'scanning' | 'monitoring' | 'offline';

export function patchPhase(device: DeviceStatus, calibration: Calibration, now: number): PatchPhase {
  if (!device.active) return 'off';

  const lastSeen = device.lastSeenAt ? Date.parse(device.lastSeenAt) : null;
  const activatedAt = device.activatedAt ? Date.parse(device.activatedAt) : 0;
  // Confirmed only by a check-in after the Activate press.
  const confirmed = device.deviceActive && lastSeen !== null && lastSeen >= activatedAt;
  if (!confirmed) return 'activating';
  if (now - lastSeen > DEVICE_STALE_SECONDS * 1000) return 'offline';

  if (calibration.status === 'complete') return 'monitoring';
  if (calibration.status === 'none') return 'ready';
  return 'scanning';
}

/** True once an activation has gone unanswered long enough to suggest a problem. */
export function activationOverdue(device: DeviceStatus, now: number) {
  const activatedAt = device.activatedAt ? Date.parse(device.activatedAt) : now;
  return now - activatedAt > ACTIVATION_TIMEOUT_SECONDS * 1000;
}
