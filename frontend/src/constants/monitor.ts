/**
 * Unit shown next to pressure values. The FSR402 isn't calibrated yet, so readings are a relative
 * index; change this to 'mmHg' once the ESP32 sends a calibrated pressure estimate.
 */
export const PRESSURE_UNIT: string = 'index';

/** A device that hasn't sent a reading for this long is shown as offline. */
export const DEVICE_STALE_SECONDS = 10;

/** How much pressure history the dashboard chart shows. */
export const TREND_MINUTES = 15;

/** Pressure that starts the alert countdown, drawn as a line on the chart. Matches the backend. */
export const ALERT_PRESSURE = 32;
