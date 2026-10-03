/**
 * Pretends to be a patient's ESP32: posts a reading to the backend every second, so the app can be
 * tried without hardware.
 *
 *   npm run simulate -- --device SP-ESP32-001 --scenario cycle
 *
 * Scenarios:
 *   cycle      (default) normal → sustained pressure with an alert → relief, repeating every 80 s
 *   normal     NORMAL risk
 *   sustained  ATTENTION, the immediate alert after 10 s, HIGH RISK after 30 s
 *   high       HIGH RISK straight away
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

const scenarios = {
  normal: () => ({ pressure: jitter(20, 0.5), temperature: jitter(36.2, 0.05), humidity: jitter(34, 0.3) }),
  sustained: () => ({ pressure: jitter(33, 0.3), temperature: jitter(36.8, 0.05), humidity: jitter(34, 0.3) }),
  high: () => ({ pressure: jitter(37, 0.5), temperature: jitter(37.2, 0.05), humidity: jitter(50, 0.5) }),
  cycle: (seconds) => {
    const t = seconds % 80;
    if (t < 20) return scenarios.normal();
    if (t < 65) {
      // Pressure held on one spot: skin warms up and gets damper the longer it lasts.
      const progress = (t - 20) / 45;
      return {
        pressure: jitter(33.8, 0.4),
        temperature: jitter(36.6 + progress * 0.6, 0.05),
        humidity: jitter(35 + progress * 6, 0.3),
      };
    }
    return { pressure: jitter(21, 0.5), temperature: jitter(36.7, 0.05), humidity: jitter(37, 0.3) };
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
  const raw = scenario((tick * interval) / 1000);
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
      const { risk, pressureDuration } = body;
      console.log(
        `${new Date().toLocaleTimeString()}  pressure ${reading.pressure}  temp ${reading.temperature} °C  ` +
          `humidity ${reading.humidity} %  →  ${risk.riskLevel} ${risk.riskScore}/${risk.maxScore}, ` +
          `held ${pressureDuration} s${risk.immediateAlert ? '   ⚠ IMMEDIATE ALERT' : ''}`
      );
    }
  } catch (error) {
    console.error(`Could not reach ${options.url}: ${error.message}`);
  }

  await new Promise((resolve) => setTimeout(resolve, interval));
}
