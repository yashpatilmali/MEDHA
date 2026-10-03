/**
 * Medha rule-based status, scored against the patient's own baseline (the 1-minute calibration
 * average). A trained model can replace `calculateRisk` later: it only needs to return the same
 * shape.
 *
 * Risk = 2 × pressure score + 2 × temperature score + humidity score + 2 × duration score
 */

export const LEVELS = ['NORMAL', 'ATTENTION', 'CRITICAL'];

export const WEIGHTS = { pressure: 2, temperature: 2, humidity: 1, duration: 2 };

/** Each score is 0, 1 or 2. */
export const MAX_RISK_SCORE =
  2 * (WEIGHTS.pressure + WEIGHTS.temperature + WEIGHTS.humidity + WEIGHTS.duration);

/**
 * Rise above baseline that scores 1 and 2. Only rises count: cooler, drier or less pressure is
 * not a pressure-injury sign.
 */
export const THRESHOLDS = {
  /** mmHg above baseline. Pressure at or above the first value counts as "elevated". */
  pressure: [10, 25],
  /** °C above baseline. A local rise of 1–2 °C is an early sign of tissue damage. */
  temperature: [1, 2],
  /** %RH above baseline. Moisture softens skin and makes it easier to injure. */
  humidity: [10, 20],
  /** Seconds pressure has stayed elevated. Demo scale: clinical repositioning is every ~2 h. */
  duration: [30, 60],
};

/** Score above which the level is ATTENTION, and CRITICAL. */
export const LEVEL_LIMITS = { attention: 3, critical: 7 };

function tier(value, [first, second]) {
  if (value >= second) return 2;
  if (value >= first) return 1;
  return 0;
}

const round = (value) => Math.round(value * 10) / 10;

/** The pressure that counts as elevated for this baseline. */
export function elevatedPressure(baseline) {
  return baseline.pressure + THRESHOLDS.pressure[0];
}

/**
 * Scores one reading against the baseline. `duration` is how many seconds pressure has stayed
 * at or above `elevatedPressure(baseline)`.
 */
export function calculateRisk(reading, baseline, duration) {
  const deltas = {
    pressure: round(reading.pressure - baseline.pressure),
    temperature: round(reading.temperature - baseline.temperature),
    humidity: round(reading.humidity - baseline.humidity),
  };
  const pressureScore = tier(deltas.pressure, THRESHOLDS.pressure);
  const temperatureScore = tier(deltas.temperature, THRESHOLDS.temperature);
  const humidityScore = tier(deltas.humidity, THRESHOLDS.humidity);
  const durationScore = tier(duration, THRESHOLDS.duration);

  const riskScore =
    WEIGHTS.pressure * pressureScore +
    WEIGHTS.temperature * temperatureScore +
    WEIGHTS.humidity * humidityScore +
    WEIGHTS.duration * durationScore;

  let riskLevel;
  if (riskScore <= LEVEL_LIMITS.attention) {
    riskLevel = 'NORMAL';
  } else if (riskScore <= LEVEL_LIMITS.critical) {
    riskLevel = 'ATTENTION';
  } else {
    riskLevel = 'CRITICAL';
  }

  return {
    pressureScore,
    temperatureScore,
    humidityScore,
    durationScore,
    riskScore,
    riskLevel,
    /** True while CRITICAL: the app shows an alert and the ESP32 can sound its buzzer. */
    immediateAlert: riskLevel === 'CRITICAL',
    deltas,
    maxScore: MAX_RISK_SCORE,
    weights: WEIGHTS,
  };
}
