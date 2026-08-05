import { Router } from 'express';
import { analyzeRepository, listRankedRepositories } from '../controllers/githubController.js';

export const githubRouter = Router();

githubRouter.get('/github/users/:username/repos', listRankedRepositories);
githubRouter.get('/github/repos/:owner/:repo/analysis', analyzeRepository);
