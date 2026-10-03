/**
 * Pretends to be a patient's ESP32, so the app can be tried without hardware. Like the real patch,
 * it checks in until "Activate sensors" is pressed in the app, then posts a reading every second
 * (pressure in mmHg). Readings stay normal until "Scan initial readings" has finished the baseline,
 * then follow the scenario. "Deactivate" in the app switches it back to checking in.
 *
 *   npm run simulate -- --device SP-ESP32-001 --scenario cycle
 *
 * Scenarios (baseline about 12 mmHg, 33 °C, 45 % RH):
 *   cycle      (default) normal → 36 mmHg held (ATTENTION after 10 s) → relief, repeating
 *   normal     NORMAL
 *   sustained  38 mmHg held: ATTENTION after 10 s
 *   warm       skin 21 % warmer than the baseline: ATTENTION straight away
 *   damp       humidity 55 % above the baseline: ATTENTION straight away
 *   high       all three at once
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

const normal = () => ({ pressure: jitter(12, 1), temperature: jitter(33, 0.1), humidity: jitter(45, 1) });

const scenarios = {
  normal,
  sustained: () => ({ pressure: jitter(38, 1), temperature: jitter(33, 0.1), humidity: jitter(45, 1) }),
  warm: () => ({ pressure: jitter(14, 1), temperature: jitter(40, 0.1), humidity: jitter(46, 1) }),
  damp: () => ({ pressure: jitter(14, 1), temperature: jitter(33.1, 0.05), humidity: jitter(70, 0.5) }),
  high: () => ({ pressure: jitter(40, 1), temperature: jitter(40, 0.1), humidity: jitter(70, 0.5) }),
  cycle: (seconds) => {
    const t = seconds % 100;
    if (t < 20) return normal();
    // Pressure held on one spot, comfortably over 32 mmHg.
    if (t < 70) return { pressure: jitter(36, 1), temperature: jitter(33.2, 0.05), humidity: jitter(46, 1) };
    return normal();
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

const deviceUrl = `${options.url}/api/devices/${encodeURIComponent(options.device)}`;
const interval = Number(options.interval);
console.log(`Simulating ${options.device} (${options.scenario}) → ${deviceUrl}`);
console.log('Waiting for "Activate sensors" in the app...\n');

async function post(path, body) {
  const response = await fetch(deviceUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Key': options.key },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const time = () => new Date().toLocaleTimeString();

let active = false;
/** When the baseline was ready: the scenario starts from there. */
let monitoringSince = null;

for (;;) {
  try {
    if (!active) {
      const { status, body } = await post('/heartbeat', { active: false });
      if (status !== 200) {
        console.error(`HTTP ${status}: ${body.error}`);
        if (status === 404) {
          console.error('Register a patient in the app first; their device ID is on the Profile tab.');
        }
        process.exit(1);
      }
      if (body.activate) {
        active = true;
        await post('/heartbeat', { active: true, sensorsOk: true });
        console.log(`${time()}  sensors activated: press "Scan initial readings" in the app`);
      }
    } else {
      const seconds = monitoringSince === null ? 0 : (Date.now() - monitoringSince) / 1000;
      const raw = monitoringSince === null ? normal() : scenario(seconds);
      const reading = {
        pressure: round(raw.pressure),
        temperature: round(raw.temperature),
        humidity: round(raw.humidity),
      };
      const { status, body } = await post('/readings', reading);

      if (body.activate === false) {
        active = false;
        monitoringSince = null;
        console.log(`${time()}  deactivated in the app: sensors off`);
      } else if (status !== 201) {
        console.error(`HTTP ${status}: ${body.error}`);
        if (status === 401 || status === 404 || status === 503) process.exit(1);
      } else {
        const { risk, pressureDuration, calibration } = body;
        if (calibration.status === 'complete') {
          monitoringSince ??= Date.now();
        } else {
          monitoringSince = null;
        }
        const state = risk
          ? `${risk.riskLevel}, ≥32 mmHg for ${pressureDuration} s` +
            (risk.immediateAlert
              ? `   ⚠ ${Object.keys(risk.triggers).filter((key) => risk.triggers[key]).join(' + ')}`
              : '')
          : calibration.status === 'none'
            ? 'activated, waiting for "Scan initial readings"'
            : `scanning initial readings (${calibration.samples})`;
        console.log(
          `${time()}  pressure ${reading.pressure} mmHg  temp ${reading.temperature} °C  ` +
            `humidity ${reading.humidity} %  →  ${state}`
        );
      }
    }
  } catch (error) {
    console.error(`Could not reach ${options.url}: ${error.message}`);
  }

  await new Promise((resolve) => setTimeout(resolve, interval));
}
