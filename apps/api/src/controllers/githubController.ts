import type { Request, Response } from 'express';
import { rankRepositories } from '@proofly/analysis-core';
import type {
  ApiErrorResponse,
  RepositoryAnalysisResponse,
  RepositoryListResponse,
} from '@proofly/shared-types';
import { GitHubClient, GitHubClientError } from '../github/githubClient.js';
import { getConfig } from '../config/env.js';
import {
  githubUsernameSchema,
  repositoryNameSchema,
  repositoryQuerySchema,
} from '../validation/github.js';
import { analyzeRepositoryFromGitHub } from '../services/repositoryAnalysisService.js';

export async function listRankedRepositories(request: Request, response: Response): Promise<void> {
  const usernameResult = githubUsernameSchema.safeParse(request.params.username);
  const queryResult = repositoryQuerySchema.safeParse(request.query);

  if (!usernameResult.success || !queryResult.success) {
    let validationMessage = 'Invalid GitHub repository request.';

    if (!usernameResult.success) {
      validationMessage = usernameResult.error.issues[0]?.message ?? validationMessage;
    } else if (!queryResult.success) {
      validationMessage = queryResult.error.issues[0]?.message ?? validationMessage;
    }

    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: validationMessage,
      },
    } satisfies ApiErrorResponse);
    return;
  }

  const config = getConfig();
  const client = new GitHubClient({ token: config.githubToken });

  try {
    const [profile, repositories] = await Promise.all([
      client.getUserProfile(usernameResult.data),
      client.listPublicRepositories(usernameResult.data),
    ]);
    const rankedRepositories = rankRepositories(repositories, queryResult.data.careerPath);

    response.json({
      username: usernameResult.data,
      careerPath: queryResult.data.careerPath,
      profile,
      repositories: rankedRepositories,
    } satisfies RepositoryListResponse);
  } catch (error) {
    if (error instanceof GitHubClientError) {
      response.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      } satisfies ApiErrorResponse);
      return;
    }

    response.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Proofly hit an unexpected server error.',
      },
    } satisfies ApiErrorResponse);
  }
}

export async function analyzeRepository(request: Request, response: Response): Promise<void> {
  const ownerResult = githubUsernameSchema.safeParse(request.params.owner);
  const repoResult = repositoryNameSchema.safeParse(request.params.repo);
  const queryResult = repositoryQuerySchema.safeParse(request.query);

  if (!ownerResult.success || !repoResult.success || !queryResult.success) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Enter a valid GitHub owner, repository name, and career path.',
      },
    } satisfies ApiErrorResponse);
    return;
  }

  const config = getConfig();
  const client = new GitHubClient({ token: config.githubToken, timeoutMs: 15_000 });

  try {
    const analysis = await analyzeRepositoryFromGitHub(
      client,
      ownerResult.data,
      repoResult.data,
      queryResult.data.careerPath,
    );

    response.json(analysis satisfies RepositoryAnalysisResponse);
  } catch (error) {
    if (error instanceof GitHubClientError) {
      response.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
        },
      } satisfies ApiErrorResponse);
      return;
    }

    response.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Proofly could not analyze this repository.',
      },
    } satisfies ApiErrorResponse);
  }
}
