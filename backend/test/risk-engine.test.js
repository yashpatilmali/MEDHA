import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  calculateRisk,
  getDurationScore,
  getHumidityScore,
  getPressureScore,
  getTemperatureScore,
  MAX_RISK_SCORE,
} from '../src/services/risk-engine.js';

const summary = (risk) => [risk.riskScore, risk.riskLevel, risk.immediateAlert];

describe('test plan', () => {
  test('Test 1 is NORMAL', () => {
    assert.deepEqual(summary(calculateRisk(20, 36.2, 34, 0)), [1, 'NORMAL', false]);
  });
  test('Test 2 is ATTENTION, alerts after 10 s and is HIGH RISK after 30 s', () => {
    assert.deepEqual(summary(calculateRisk(33, 36.8, 34, 0)), [5, 'ATTENTION', false]);
    assert.deepEqual(summary(calculateRisk(33, 36.8, 34, 10)), [7, 'ATTENTION', true]);
    assert.deepEqual(summary(calculateRisk(33, 36.8, 34, 30)), [9, 'HIGH RISK', true]);
  });
  test('Test 3 is HIGH RISK', () => {
    assert.deepEqual(summary(calculateRisk(37, 37.2, 50, 0)), [10, 'HIGH RISK', false]);
  });
  test('worked example: 2(2) + 1 + 0 + 2(1) = 7', () => {
    const risk = calculateRisk(33.4, 36.7, 34.2, 14);
    assert.deepEqual(
      [risk.pressureScore, risk.temperatureScore, risk.humidityScore, risk.durationScore, risk.riskScore],
      [2, 1, 0, 1, 7]
    );
  });
});

describe('score tiers', () => {
  const tiers = (fn, cases) => {
    for (const [value, score] of cases) assert.equal(fn(value), score, `${fn.name}(${value})`);
  };
  test('pressure', () =>
    tiers(getPressureScore, [[0, 0], [24.99, 0], [25, 1], [31.99, 1], [32, 2], [34.99, 2], [35, 3], [100, 3]]));
  test('temperature', () => tiers(getTemperatureScore, [[35.99, 0], [36, 1], [36.99, 1], [37, 2]]));
  test('humidity', () =>
    tiers(getHumidityScore, [[19.9, 2], [20, 1], [29.9, 1], [30, 0], [37, 0], [37.1, 1], [47, 1], [47.1, 2]]));
  test('duration', () => tiers(getDurationScore, [[0, 0], [9, 0], [10, 1], [29, 1], [30, 2]]));
});

describe('levels and alert', () => {
  test('level boundaries at 3/4 and 7/8', () => {
    assert.deepEqual(summary(calculateRisk(25, 36, 30, 0)).slice(0, 2), [3, 'NORMAL']);
    assert.deepEqual(summary(calculateRisk(25, 36, 25, 0)).slice(0, 2), [4, 'ATTENTION']);
    assert.deepEqual(summary(calculateRisk(32, 36, 25, 10)).slice(0, 2), [8, 'HIGH RISK']);
  });
  test('maximum score is 14 and is reported with the result', () => {
    const risk = calculateRisk(40, 38, 60, 40);
    assert.equal(risk.riskScore, 14);
    assert.equal(MAX_RISK_SCORE, 14);
    assert.equal(risk.maxScore, 14);
  });
  test('immediate alert needs pressure ≥ 32 for ≥ 10 s', () => {
    assert.equal(calculateRisk(31.99, 36, 34, 100).immediateAlert, false);
    assert.equal(calculateRisk(32, 36, 34, 9).immediateAlert, false);
    assert.equal(calculateRisk(32, 36, 34, 10).immediateAlert, true);
  });
});
