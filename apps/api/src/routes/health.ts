import { Router } from 'express';
import type { HealthResponse } from '@proofly/shared-types';

export const healthRouter = Router();

healthRouter.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'proofly-api',
    timestamp: new Date().toISOString(),
  } satisfies HealthResponse);
});
