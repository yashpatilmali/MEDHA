/**
 * Pretends to be a patient's ESP32: posts a reading to the backend every second, so the app can be
 * tried without hardware.
 *
 *   npm run simulate -- --device SP-ESP32-001 --scenario cycle
 *
 * Each scenario starts with a minute of normal readings, which the backend averages into the
 * patient's baseline (pressure in mmHg, like the ESP32 sends).
 *
 * Scenarios:
 *   cycle      (default) normal → pressure held on warming, damp skin → relief, repeating
 *   normal     NORMAL
 *   sustained  pressure 28 mmHg over baseline: ATTENTION, CRITICAL after 60 s
 *   high       pressure on skin 2 °C warmer and much damper: CRITICAL straight away
 *
 * Options: --url (default http://localhost:PORT), --key (default DEVICE_API_KEY from .env),
 *          --interval in ms (default 1000)
 */

import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // No .env file.
}

const { values: options } = parseArgs({
  options: {
    device: { type: 'string', default: 'SP-ESP32-001' },
    scenario: { type: 'string', default: 'cycle' },
    url: { type: 'string', default: `http://localhost:${process.env.PORT || 4000}` },
    key: { type: 'string', default: process.env.DEVICE_API_KEY },
    interval: { type: 'string', default: '1000' },
  },
});

const jitter = (value, amount) => value + (Math.random() * 2 - 1) * amount;
const round = (value) => Math.round(value * 10) / 10;

/** Seconds of normal readings at the start, while the backend calibrates the baseline. */
const CALIBRATION_SECONDS = 62;

const normal = () => ({ pressure: jitter(12, 1), temperature: jitter(33, 0.1), humidity: jitter(45, 1) });

const scenarios = {
  normal,
  sustained: () => ({ pressure: jitter(40, 1), temperature: jitter(33.2, 0.1), humidity: jitter(46, 1) }),
  high: () => ({ pressure: jitter(40, 1), temperature: jitter(35.2, 0.1), humidity: jitter(66, 1) }),
  cycle: (seconds) => {
    const t = seconds % 140;
    if (t < 20) return normal();
    if (t < 110) {
      // Pressure held on one spot: skin warms up and gets damper the longer it lasts.
      const progress = (t - 20) / 90;
      return {
        pressure: jitter(32, 1),
        temperature: jitter(33 + progress * 2.4, 0.1),
        humidity: jitter(45 + progress * 18, 1),
      };
    }
    return { pressure: jitter(12, 1), temperature: jitter(34, 0.1), humidity: jitter(50, 1) };
  },
};

const scenario = scenarios[options.scenario];
if (!scenario) {
  console.error(`Unknown scenario "${options.scenario}". Use one of: ${Object.keys(scenarios).join(', ')}`);
  process.exit(1);
}
if (!options.key) {
  console.error('No device key: set DEVICE_API_KEY in backend/.env or pass --key.');
  process.exit(1);
}

const endpoint = `${options.url}/api/devices/${encodeURIComponent(options.device)}/readings`;
const interval = Number(options.interval);
console.log(`Simulating ${options.device} (${options.scenario}) → ${endpoint}\n`);

for (let tick = 0; ; tick += 1) {
  const seconds = (tick * interval) / 1000;
  const raw = seconds < CALIBRATION_SECONDS ? normal() : scenario(seconds - CALIBRATION_SECONDS);
  const reading = {
    pressure: round(raw.pressure),
    temperature: round(raw.temperature),
    humidity: round(raw.humidity),
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Key': options.key },
      body: JSON.stringify(reading),
    });
    const body = await response.json();
    if (!response.ok) {
      console.error(`HTTP ${response.status}: ${body.error}`);
      if (response.status === 404) {
        console.error('Register a patient in the app first; their device ID is on the Profile tab.');
      }
      if (response.status === 401 || response.status === 404 || response.status === 503) {
        process.exit(1);
      }
    } else {
      const { risk, pressureDuration, calibration } = body;
      const status = risk
        ? `${risk.riskLevel} ${risk.riskScore}/${risk.maxScore}, held ${pressureDuration} s` +
          (risk.immediateAlert ? '   ⚠ CRITICAL ALERT' : '')
        : `calibrating baseline (${calibration.samples} readings)`;
      console.log(
        `${new Date().toLocaleTimeString()}  pressure ${reading.pressure} mmHg  ` +
          `temp ${reading.temperature} °C  humidity ${reading.humidity} %  →  ${status}`
      );
    }
  } catch (error) {
    console.error(`Could not reach ${options.url}: ${error.message}`);
  }

  await new Promise((resolve) => setTimeout(resolve, interval));
}
