import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { calculateRisk, pressureAttentionPercent } from '../src/services/risk-engine.js';

const baseline = { pressure: 24, temperature: 36.4, humidity: 40 };
const level = (reading, duration = 0) => calculateRisk(reading, baseline, duration).riskLevel;
const triggers = (reading, duration = 0) => calculateRisk(reading, baseline, duration).triggers;

describe('the specification examples', () => {
  test('27 mmHg, +0.2 °C, +10 % humidity is NORMAL', () => {
    const risk = calculateRisk({ pressure: 27, temperature: 36.6, humidity: 44 }, baseline, 0);
    assert.equal(risk.riskLevel, 'NORMAL');
    assert.equal(risk.immediateAlert, false);
    assert.deepEqual(risk.deltas, { pressure: 3, temperature: 0.2, humidity: 4 });
    assert.equal(risk.percentChanges.humidity, 10);
  });

  test('33 mmHg held for 12 s is ATTENTION for prolonged pressure', () => {
    const risk = calculateRisk({ pressure: 33, temperature: 36.9, humidity: 45 }, baseline, 12);
    assert.equal(risk.riskLevel, 'ATTENTION');
    assert.equal(risk.immediateAlert, true);
    assert.equal(risk.triggers.pressure, true);
  });
});

describe('pressure', () => {
  const normal = { temperature: 36.4, humidity: 40 };

  test('needs 32 mmHg held for 10 s', () => {
    assert.equal(level({ ...normal, pressure: 31.9 }, 60), 'NORMAL');
    assert.equal(level({ ...normal, pressure: 32 }, 9), 'NORMAL');
    assert.equal(level({ ...normal, pressure: 32 }, 10), 'ATTENTION');
  });

  test('the 32 mmHg threshold is expressed as a rise from each baseline', () => {
    assert.equal(pressureAttentionPercent(20), 60);
    assert.equal(pressureAttentionPercent(22), 45.5);
    assert.equal(pressureAttentionPercent(24), 33.3);
    assert.equal(pressureAttentionPercent(30), 6.7);
    assert.equal(pressureAttentionPercent(0), null);
  });
});

describe('temperature', () => {
  test('ATTENTION from a 0.5 °C rise', () => {
    assert.equal(triggers({ pressure: 24, temperature: 36.8, humidity: 40 }).temperature, false);
    assert.equal(triggers({ pressure: 24, temperature: 36.9, humidity: 40 }).temperature, true);
  });

  test('a 0.5 °C rise counts even when the subtraction rounds just under it', () => {
    const risk = calculateRisk({ pressure: 24, temperature: 36.6, humidity: 40 }, { ...baseline, temperature: 36.1 }, 0);
    assert.equal(risk.riskLevel, 'ATTENTION');
  });

  test('36.5 → 37.0 °C is +0.5 °C, about +1.37 %', () => {
    const risk = calculateRisk({ pressure: 24, temperature: 37, humidity: 40 }, { ...baseline, temperature: 36.5 }, 0);
    assert.equal(risk.deltas.temperature, 0.5);
    assert.equal(risk.percentChanges.temperature, 1.4);
  });
});

describe('humidity', () => {
  test('ATTENTION from a 50 % relative rise: 40 → 60 % RH', () => {
    assert.equal(triggers({ pressure: 24, temperature: 36.4, humidity: 59.9 }).humidity, false);
    assert.equal(triggers({ pressure: 24, temperature: 36.4, humidity: 60 }).humidity, true);
  });
});

describe('falls', () => {
  test('below the baseline never cause ATTENTION', () => {
    assert.equal(level({ pressure: 0, temperature: 30, humidity: 10 }), 'NORMAL');
  });
});
