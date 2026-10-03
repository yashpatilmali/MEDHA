/**
 * Sparsh prototype risk scoring.
 *
 * Risk = 2 × pressure score + temperature score + humidity score + 2 × duration score
 */

export const WEIGHTS = { pressure: 2, temperature: 1, humidity: 1, duration: 2 };

/** 2 × pressure (max 3) + temperature (max 2) + humidity (max 2) + 2 × duration (max 2). */
export const MAX_RISK_SCORE =
  WEIGHTS.pressure * 3 + WEIGHTS.temperature * 2 + WEIGHTS.humidity * 2 + WEIGHTS.duration * 2;

/** The immediate alert fires once pressure has stayed at or above ALERT_PRESSURE for ALERT_DURATION_SEC. */
export const ALERT_PRESSURE = 32;
export const ALERT_DURATION_SEC = 10;

export function getPressureScore(pressure) {
  if (pressure < 25) return 0;
  if (pressure < 32) return 1;
  if (pressure < 35) return 2;
  return 3;
}

export function getTemperatureScore(temperature) {
  if (temperature < 36) return 0;
  if (temperature < 37) return 1;
  return 2;
}

export function getHumidityScore(humidity) {
  if (humidity >= 30 && humidity <= 37) return 0;
  if ((humidity >= 20 && humidity < 30) || (humidity > 37 && humidity <= 47)) return 1;
  return 2;
}

export function getDurationScore(duration) {
  if (duration < 10) return 0;
  if (duration < 30) return 1;
  return 2;
}

/** `duration` is how many seconds pressure has stayed at or above ALERT_PRESSURE. */
export function calculateRisk(pressure, temperature, humidity, duration) {
  const pressureScore = getPressureScore(pressure);
  const temperatureScore = getTemperatureScore(temperature);
  const humidityScore = getHumidityScore(humidity);
  const durationScore = getDurationScore(duration);

  const riskScore =
    WEIGHTS.pressure * pressureScore +
    WEIGHTS.temperature * temperatureScore +
    WEIGHTS.humidity * humidityScore +
    WEIGHTS.duration * durationScore;

  let riskLevel;
  if (riskScore <= 3) {
    riskLevel = 'NORMAL';
  } else if (riskScore <= 7) {
    riskLevel = 'ATTENTION';
  } else {
    riskLevel = 'HIGH RISK';
  }

  return {
    pressureScore,
    temperatureScore,
    humidityScore,
    durationScore,
    riskScore,
    riskLevel,
    immediateAlert: pressure >= ALERT_PRESSURE && duration >= ALERT_DURATION_SEC,
    maxScore: MAX_RISK_SCORE,
    weights: WEIGHTS,
  };
}
