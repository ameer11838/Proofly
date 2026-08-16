import { Router } from 'express';
import {
  analyzeRepository,
  getCareerScore,
  listRankedRepositories,
  streamCareerScore,
  streamRepositoryAnalysis,
} from '../controllers/githubController.js';

export const githubRouter = Router();

githubRouter.get('/github/users/:username/repos', listRankedRepositories);
githubRouter.get('/github/users/:username/career-score', getCareerScore);
githubRouter.get(
  '/github/users/:username/career-score/stream',
  streamCareerScore,
);
githubRouter.get('/github/repos/:owner/:repo/analysis', analyzeRepository);
githubRouter.get(
  '/github/repos/:owner/:repo/analysis/stream',
  streamRepositoryAnalysis,
);
