/**
 * SPARSH two-state status: NORMAL or ATTENTION, judged against each patient's own baseline (the
 * 1-minute initial scan) rather than one raw value for everyone.
 *
 * ATTENTION when any of these holds:
 *   pressure     ≥ 32 mmHg, held for ≥ 10 s
 *   temperature  ≥ 0.5 °C above the baseline
 *   humidity     ≥ 50 % above the baseline (relative change)
 *
 * These are prototype engineering rules derived from the observations in the reference paper
 * (an alert at 32 mmHg with 10 s loading, a 0.5 °C rise, a 50 % humidity rise). They are not
 * clinically validated thresholds.
 */

/** mmHg. Attention once pressure stays at or above this for ALERT_DURATION_SEC. */
export const ALERT_PRESSURE = 32;
export const ALERT_DURATION_SEC = 10;
/** °C above the baseline. */
export const TEMPERATURE_RISE = 0.5;
/** % above the baseline, relative to it. */
export const HUMIDITY_RISE_PERCENT = 50;

export const THRESHOLDS = {
  pressure: ALERT_PRESSURE,
  durationSeconds: ALERT_DURATION_SEC,
  temperatureRise: TEMPERATURE_RISE,
  humidityRisePercent: HUMIDITY_RISE_PERCENT,
};

// Sensor values have one decimal, so differences like 36.6 - 36.1 can land a hair under 0.5.
const EPSILON = 1e-9;

const round1 = (value) => Math.round(value * 10) / 10;

/** ((value - baseline) / baseline) × 100, or null when the baseline is 0 or below. */
function rawPercentChange(value, baseline) {
  return baseline > 0 ? ((value - baseline) / baseline) * 100 : null;
}

export function percentChange(value, baseline) {
  const change = rawPercentChange(value, baseline);
  return change === null ? null : round1(change);
}

/** The patient's personal equivalent of 32 mmHg, e.g. +33.3 % for a 24 mmHg baseline. */
export function pressureAttentionPercent(baselinePressure) {
  return percentChange(ALERT_PRESSURE, baselinePressure);
}

/**
 * Scores a reading against the baseline. `pressureDuration` is how many seconds pressure has
 * stayed at or above ALERT_PRESSURE.
 */
export function calculateRisk(reading, baseline, pressureDuration) {
  const temperatureRise = reading.temperature - baseline.temperature;
  const humidityChange = rawPercentChange(reading.humidity, baseline.humidity);

  const triggers = {
    pressure: reading.pressure >= ALERT_PRESSURE && pressureDuration >= ALERT_DURATION_SEC,
    temperature: temperatureRise >= TEMPERATURE_RISE - EPSILON,
    humidity: humidityChange !== null && humidityChange >= HUMIDITY_RISE_PERCENT - EPSILON,
  };
  const riskLevel = triggers.pressure || triggers.temperature || triggers.humidity ? 'ATTENTION' : 'NORMAL';

  return {
    riskLevel,
    /** True while ATTENTION: the patch buzzes, the alert is recorded and the caretaker is texted. */
    immediateAlert: riskLevel === 'ATTENTION',
    /** Which rules put the reading in ATTENTION. */
    triggers,
    /** Change from the baseline, in each sensor's unit. */
    deltas: {
      pressure: round1(reading.pressure - baseline.pressure),
      temperature: round1(temperatureRise),
      humidity: round1(reading.humidity - baseline.humidity),
    },
    /** Change from the baseline in %; null when the baseline is 0. */
    percentChanges: {
      pressure: percentChange(reading.pressure, baseline.pressure),
      temperature: percentChange(reading.temperature, baseline.temperature),
      humidity: humidityChange === null ? null : round1(humidityChange),
    },
    pressureAttentionPercent: pressureAttentionPercent(baseline.pressure),
    thresholds: THRESHOLDS,
  };
}
