import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Load backend/.env when it exists. Hosting platforms set real environment variables instead.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // No .env file.
}

const env = process.env;

/** Uses the variable if set; otherwise a random value, so nothing insecure is ever hard-coded. */
function secretOrRandom(name) {
  if (env[name]) return env[name];
  console.warn(`${name} is not set: using a random value, so logins reset when the server restarts.`);
  return crypto.randomBytes(32).toString('hex');
}

function smtpConfig() {
  if (!env.SMTP_HOST) return null;
  return {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT) || 587,
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM || env.SMTP_USER,
  };
}

export const config = {
  isProduction: env.NODE_ENV === 'production',
  port: Number(env.PORT) || 4000,
  /** MongoDB connection string. Optional in development, where an in-memory database is used. */
  mongoUri: env.MONGODB_URI || null,
  jwtSecret: secretOrRandom('JWT_SECRET'),
  jwtExpiresIn: env.JWT_EXPIRES_IN || '30d',
  /** Shared key every ESP32 sends in the X-Device-Key header. Device uploads are refused without it. */
  deviceApiKey: env.DEVICE_API_KEY || null,
  /** "*" or a comma-separated list of allowed web origins. */
  corsOrigin: env.CORS_ORIGIN || '*',
  /** Login/signup/reset requests allowed per IP address every 15 minutes. */
  authRateLimit: Number(env.AUTH_RATE_LIMIT) || 30,
  /** How long reading history is kept. */
  historyRetentionDays: Number(env.HISTORY_RETENTION_DAYS) || 30,
  smtp: smtpConfig(),
};
