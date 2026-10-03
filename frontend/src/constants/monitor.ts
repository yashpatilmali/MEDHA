/**
 * Unit shown next to pressure values. The ESP32 converts the FSR403 force to mmHg, using a
 * temporary force-per-ADC factor until the sensor is calibrated against known weights.
 */
export const PRESSURE_UNIT: string = 'mmHg';

/** A patch that hasn't checked in for this long is shown as offline. It checks in every ~2 s. */
export const DEVICE_STALE_SECONDS = 15;

/** An activated patch that hasn't confirmed after this long is probably off or not on Wi-Fi. */
export const ACTIVATION_TIMEOUT_SECONDS = 20;

/** How much pressure history the dashboard chart shows. */
export const TREND_MINUTES = 15;
