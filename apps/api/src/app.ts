import cors from 'cors';
import express from 'express';
import { getConfig } from './config/env.js';
import { githubRouter } from './routes/github.js';
import { healthRouter } from './routes/health.js';

export function createApp() {
  const app = express();
  const config = getConfig();

  app.use(
    cors({
      origin: config.webOrigin,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);
  app.use('/api', githubRouter);

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested Proofly API route does not exist.',
      },
    });
  });

  return app;
}
