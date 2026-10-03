/**
 * Unit shown next to pressure values. The ESP32 converts the FSR403 force to mmHg, using a
 * temporary force-per-ADC factor until the sensor is calibrated against known weights.
 */
export const PRESSURE_UNIT: string = 'mmHg';

/** A device that hasn't sent a reading for this long is shown as offline. */
export const DEVICE_STALE_SECONDS = 10;

/** How much pressure history the dashboard chart shows. */
export const TREND_MINUTES = 15;
