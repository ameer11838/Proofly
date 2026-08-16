import type { Request, Response } from 'express';
import { rankRepositories } from '@proofly/analysis-core';
import type {
  ApiErrorResponse,
  CareerScoreResponse,
  RepositoryAnalysisResponse,
  RepositoryListResponse,
} from '@proofly/shared-types';
import { buildUserCareerScore } from '../services/careerScoreService.js';
import { GitHubClient, GitHubClientError } from '../github/githubClient.js';
import { getConfig } from '../config/env.js';
import {
  githubUsernameSchema,
  repositoryNameSchema,
  repositoryQuerySchema,
} from '../validation/github.js';
import { analyzeRepositoryFromGitHub } from '../services/repositoryAnalysisService.js';
import { mapWithConcurrency } from '../services/repositoryAnalysisService.js';
import {
  resolveForkContributions,
  summarizeContribution,
  unavailableContributionSummary,
} from '../services/contributionService.js';

export async function listRankedRepositories(
  request: Request,
  response: Response,
): Promise<void> {
  const usernameResult = githubUsernameSchema.safeParse(
    request.params.username,
  );
  const queryResult = repositoryQuerySchema.safeParse(request.query);

  if (!usernameResult.success || !queryResult.success) {
    let validationMessage = 'Invalid GitHub repository request.';

    if (!usernameResult.success) {
      validationMessage =
        usernameResult.error.issues[0]?.message ?? validationMessage;
    } else if (!queryResult.success) {
      validationMessage =
        queryResult.error.issues[0]?.message ?? validationMessage;
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
    const attributedRepositories = await mapWithConcurrency(
      repositories,
      5,
      async (repository) => {
        if (!repository.fork) return repository;
        try {
          const resolution = await resolveForkContributions(
            client,
            repository,
            profile,
          );
          return {
            ...repository,
            userContribution: summarizeContribution(resolution.report),
          };
        } catch (error) {
          const reason =
            error instanceof GitHubClientError &&
            error.code === 'GITHUB_RATE_LIMITED'
              ? 'GitHub rate limit reached before contributions could be verified.'
              : undefined;
          return {
            ...repository,
            userContribution: unavailableContributionSummary(
              profile.login,
              reason,
            ),
          };
        }
      },
    );
    const rankedRepositories = rankRepositories(
      attributedRepositories,
      queryResult.data.careerPath,
    );

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

/**
 * Streams the analysis as it happens. Every event corresponds to a real phase boundary in
 * the analyzer, so the client never has to invent progress.
 */
export async function streamRepositoryAnalysis(
  request: Request,
  response: Response,
): Promise<void> {
  const ownerResult = githubUsernameSchema.safeParse(request.params.owner);
  const repoResult = repositoryNameSchema.safeParse(request.params.repo);
  const queryResult = repositoryQuerySchema.safeParse(request.query);

  if (!ownerResult.success || !repoResult.success || !queryResult.success) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message:
          'Enter a valid GitHub owner, repository name, and career path.',
      },
    } satisfies ApiErrorResponse);
    return;
  }

  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Stops proxies from buffering the stream into a single response.
    'X-Accel-Buffering': 'no',
  });
  response.flushHeaders?.();

  let clientGone = false;
  request.on('close', () => {
    clientGone = true;
  });

  const send = (event: string, data: unknown) => {
    if (!clientGone) {
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  const config = getConfig();
  const client = new GitHubClient({
    token: config.githubToken,
    timeoutMs: 15_000,
  });

  try {
    const [repository, profile] = await Promise.all([
      client.getRepository(ownerResult.data, repoResult.data),
      client.getUserProfile(ownerResult.data),
    ]);
    const contributionResolution = repository.fork
      ? await resolveForkContributions(client, repository, profile)
      : undefined;
    const analysis = await analyzeRepositoryFromGitHub(
      client,
      ownerResult.data,
      repoResult.data,
      queryResult.data.careerPath,
      {
        onProgress: (event) => send('progress', event),
        knownRepository: repository,
        contributionResolution,
      },
    );

    send('result', analysis satisfies RepositoryAnalysisResponse);
  } catch (error) {
    send(
      'failure',
      error instanceof GitHubClientError
        ? { error: { code: error.code, message: error.message } }
        : {
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Proofly could not analyze this repository.',
            },
          },
    );
  } finally {
    response.end();
  }
}

/**
 * Streams the portfolio pass. A user with 100 repositories waits a while, so the client
 * needs to see which repository is being read rather than a spinner.
 */
export async function streamCareerScore(
  request: Request,
  response: Response,
): Promise<void> {
  const usernameResult = githubUsernameSchema.safeParse(
    request.params.username,
  );
  const queryResult = repositoryQuerySchema.safeParse(request.query);

  if (!usernameResult.success || !queryResult.success) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Enter a valid GitHub username and target career.',
      },
    } satisfies ApiErrorResponse);
    return;
  }

  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  response.flushHeaders?.();

  let clientGone = false;
  request.on('close', () => {
    clientGone = true;
  });

  const send = (event: string, data: unknown) => {
    if (!clientGone) {
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  const config = getConfig();
  const client = new GitHubClient({
    token: config.githubToken,
    timeoutMs: 20_000,
  });

  try {
    const portfolio = await buildUserCareerScore(
      client,
      usernameResult.data,
      queryResult.data.careerPath,
      { onProgress: (event) => send('progress', event) },
    );

    send('result', {
      username: usernameResult.data,
      careerPath: queryResult.data.careerPath,
      portfolio,
    } satisfies CareerScoreResponse);
  } catch (error) {
    send(
      'failure',
      error instanceof GitHubClientError
        ? { error: { code: error.code, message: error.message } }
        : {
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Proofly could not build a portfolio career score.',
            },
          },
    );
  } finally {
    response.end();
  }
}

export async function getCareerScore(
  request: Request,
  response: Response,
): Promise<void> {
  const usernameResult = githubUsernameSchema.safeParse(
    request.params.username,
  );
  const queryResult = repositoryQuerySchema.safeParse(request.query);

  if (!usernameResult.success || !queryResult.success) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: usernameResult.success
          ? 'Choose a valid target career.'
          : (usernameResult.error.issues[0]?.message ??
            'Enter a valid GitHub username.'),
      },
    } satisfies ApiErrorResponse);
    return;
  }

  const config = getConfig();
  const client = new GitHubClient({
    token: config.githubToken,
    timeoutMs: 20_000,
  });

  try {
    const portfolio = await buildUserCareerScore(
      client,
      usernameResult.data,
      queryResult.data.careerPath,
    );

    response.json({
      username: usernameResult.data,
      careerPath: queryResult.data.careerPath,
      portfolio,
    } satisfies CareerScoreResponse);
  } catch (error) {
    if (error instanceof GitHubClientError) {
      response.status(error.statusCode).json({
        error: { code: error.code, message: error.message },
      } satisfies ApiErrorResponse);
      return;
    }

    response.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Proofly could not build a portfolio career score.',
      },
    } satisfies ApiErrorResponse);
  }
}

export async function analyzeRepository(
  request: Request,
  response: Response,
): Promise<void> {
  const ownerResult = githubUsernameSchema.safeParse(request.params.owner);
  const repoResult = repositoryNameSchema.safeParse(request.params.repo);
  const queryResult = repositoryQuerySchema.safeParse(request.query);

  if (!ownerResult.success || !repoResult.success || !queryResult.success) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message:
          'Enter a valid GitHub owner, repository name, and career path.',
      },
    } satisfies ApiErrorResponse);
    return;
  }

  const config = getConfig();
  const client = new GitHubClient({
    token: config.githubToken,
    timeoutMs: 15_000,
  });

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
