import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

export function createApp() {
  const app = express();
  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin }));
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ data: { ok: true, service: 'notely' } });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { message: 'That path is not on the map.' } });
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: { message: 'Something went wrong in the woodland. Please try again.' } });
  });

  return app;
}
