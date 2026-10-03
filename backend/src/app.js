import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { config } from './config.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { authRouter } from './routes/auth.js';
import { deviceRouter } from './routes/devices.js';
import { monitoringRouter } from './routes/monitoring.js';

export function createApp() {
  const app = express();

  // Hosts like Render and Railway sit behind one proxy; trust it so rate limits see real client IPs.
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',') }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/', (req, res) => {
    res.json({ name: 'Sparsh API', health: '/api/health' });
  });
  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/monitoring', monitoringRouter);
  app.use('/api/devices', deviceRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
