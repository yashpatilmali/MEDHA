import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { calculateRisk, elevatedPressure, MAX_RISK_SCORE } from '../src/services/risk-engine.js';

const baseline = { pressure: 12, temperature: 33, humidity: 45 };
const at = (rise, duration = 0) =>
  calculateRisk(
    {
      pressure: baseline.pressure + (rise.pressure ?? 0),
      temperature: baseline.temperature + (rise.temperature ?? 0),
      humidity: baseline.humidity + (rise.humidity ?? 0),
    },
    baseline,
    duration
  );
const summary = (risk) => [risk.riskScore, risk.riskLevel, risk.immediateAlert];

describe('levels against the baseline', () => {
  test('the baseline itself is NORMAL', () => {
    assert.deepEqual(summary(at({})), [0, 'NORMAL', false]);
  });

  test('falls below the baseline never add risk', () => {
    assert.deepEqual(summary(at({ pressure: -10, temperature: -3, humidity: -30 })), [0, 'NORMAL', false]);
  });

  test('a 2 °C local temperature rise alone needs attention', () => {
    assert.deepEqual(summary(at({ temperature: 2 })), [4, 'ATTENTION', false]);
  });

  test('high pressure becomes CRITICAL once it is sustained for 60 s', () => {
    assert.deepEqual(summary(at({ pressure: 30 })), [4, 'ATTENTION', false]);
    assert.deepEqual(summary(at({ pressure: 30 }, 30)), [6, 'ATTENTION', false]);
    assert.deepEqual(summary(at({ pressure: 30 }, 60)), [8, 'CRITICAL', true]);
  });

  test('pressure on warm, damp skin is CRITICAL straight away', () => {
    assert.deepEqual(summary(at({ pressure: 12, temperature: 2, humidity: 20 })), [8, 'CRITICAL', true]);
  });

  test('reports each rise above the baseline', () => {
    const risk = at({ pressure: 10.04, temperature: 1.2, humidity: 15 });
    assert.deepEqual(risk.deltas, { pressure: 10, temperature: 1.2, humidity: 15 });
    assert.deepEqual(
      [risk.pressureScore, risk.temperatureScore, risk.humidityScore, risk.durationScore],
      [1, 1, 1, 0]
    );
  });
});

describe('limits', () => {
  test('maximum score is 14 and is reported with the result', () => {
    const risk = at({ pressure: 50, temperature: 5, humidity: 40 }, 120);
    assert.equal(risk.riskScore, MAX_RISK_SCORE);
    assert.equal(risk.maxScore, 14);
  });

  test('pressure counts as elevated from 10 above the baseline', () => {
    assert.equal(elevatedPressure(baseline), 22);
  });
});
