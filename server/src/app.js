import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { HttpError } from './errors.js';
import { ensureFoundation } from './repo/shared.js';
import { registerRoutes } from './routes.js';

export function createApp() {
  ensureFoundation();
  const app = express();
  const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin }));
  app.use(express.json({ limit: '8mb' }));

  registerRoutes(app);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { message: 'That path is not on the map.' } });
  });

  app.use((error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof SyntaxError && error.status === 400) {
      res.status(400).json({ error: { message: 'The request body is not valid JSON.' } });
      return;
    }
    if (error instanceof HttpError) {
      res.status(error.status).json({
        error: {
          message: error.message,
          ...(error.code ? { code: error.code } : {}),
          ...(error.details ? { details: error.details } : {}),
          ...(error.current ? { current: error.current } : {}),
        },
      });
      return;
    }
    console.error(error);
    res.status(500).json({ error: { message: 'Something went wrong in the woodland. Please try again.' } });
  });

  return app;
}
