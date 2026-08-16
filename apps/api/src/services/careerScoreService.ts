import {
  buildCareerPortfolioScore,
  rankRepositories,
  type PortfolioRepositoryOutcome,
} from '@proofly/analysis-core';
import type {
  CareerPath,
  CareerPortfolioScore,
  GitHubRepository,
  PortfolioProgressEvent,
  RepositoryAnalysisResponse,
  UserContributionSummary,
} from '@proofly/shared-types';
import { GitHubClient, GitHubClientError } from '../github/githubClient.js';
import {
  analyzeRepositoryFromGitHub,
  mapWithConcurrency,
} from './repositoryAnalysisService.js';
import {
  resolveForkContributions,
  summarizeContribution,
  type ContributionResolution,
} from './contributionService.js';

/**
 * Upper bound on repositories considered. GitHub's owner listing returns at most 100 per
 * page and Proofly reads the first page, so this matches what the ranking pass can see.
 */
export const maxConsideredRepositories = 100;

/**
 * Repositories read concurrently. Each one costs a single REST call (the tree) plus raw
 * CDN reads, so this bounds REST pressure while keeping the pass responsive.
 */
const repositoryConcurrency = 5;

/** Repository analyses are cached until the repository is pushed to again. */
const analysisCacheTtlMs = 30 * 60 * 1000;
const maxCacheEntries = 400;

interface CacheEntry {
  analysis: RepositoryAnalysisResponse;
  storedAt: number;
}

/**
 * Keyed on the repository, its career path, and its last push, so a repository is never
 * re-read while nothing about it has changed.
 */
const analysisCache = new Map<string, CacheEntry>();

function cacheKey(
  repository: GitHubRepository,
  careerPath: CareerPath,
): string {
  return `${repository.fullName}@${repository.defaultBranch}@${repository.pushedAt ?? 'never'}@${repository.userContribution?.lastCommitAt ?? 'whole-repo'}@${careerPath}`;
}

function readCache(key: string): RepositoryAnalysisResponse | null {
  const entry = analysisCache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.storedAt > analysisCacheTtlMs) {
    analysisCache.delete(key);
    return null;
  }

  return entry.analysis;
}

function writeCache(key: string, analysis: RepositoryAnalysisResponse): void {
  if (analysisCache.size >= maxCacheEntries) {
    const oldest = analysisCache.keys().next();
    if (!oldest.done) {
      analysisCache.delete(oldest.value);
    }
  }

  analysisCache.set(key, { analysis, storedAt: Date.now() });
}

/** Reasons a repository is never worth spending an API call on. */
function ineligibleReason(repository: GitHubRepository): string | null {
  if (repository.fork) {
    if (!repository.userContribution?.verified) {
      return (
        repository.userContribution?.reason ??
        'No contributions from this GitHub user were found.'
      );
    }
  }

  if (repository.size === 0) {
    return 'Empty repository: GitHub reports no content to read.';
  }

  return null;
}

export interface CareerScoreOptions {
  onProgress?: (event: PortfolioProgressEvent) => void;
}

export async function buildUserCareerScore(
  client: GitHubClient,
  username: string,
  careerPath: CareerPath,
  { onProgress }: CareerScoreOptions = {},
): Promise<CareerPortfolioScore> {
  const report = onProgress ?? (() => {});

  report({
    stage: 'discovering',
    status: 'active',
    message: `LISTING PUBLIC REPOSITORIES FOR @${username.toUpperCase()}...`,
  });

  const [allRepositories, profile] = await Promise.all([
    client.listPublicRepositories(username),
    client.getUserProfile(username),
  ]);
  const repositories = allRepositories.slice(0, maxConsideredRepositories);

  const contributionResolutions = new Map<string, ContributionResolution>();
  let rateLimited = false;
  const attributedRepositories = await mapWithConcurrency(
    repositories,
    repositoryConcurrency,
    async (repository) => {
      if (!repository.fork) return repository;
      try {
        const resolution = await resolveForkContributions(
          client,
          repository,
          profile,
        );
        contributionResolutions.set(repository.fullName, resolution);
        return {
          ...repository,
          userContribution: summarizeContribution(resolution.report),
        };
      } catch (error) {
        if (
          error instanceof GitHubClientError &&
          error.code === 'GITHUB_RATE_LIMITED'
        ) {
          rateLimited = true;
        }
        return {
          ...repository,
          userContribution: unavailableContribution(username, error),
        };
      }
    },
  );

  report({
    stage: 'discovering',
    status: 'complete',
    message:
      allRepositories.length > repositories.length
        ? `DISCOVERED ${allRepositories.length} REPOSITORIES · CONSIDERING THE FIRST ${repositories.length}`
        : `DISCOVERED ${repositories.length} PUBLIC REPOSITORIES`,
    counters: { discovered: repositories.length },
    stageProgress: 1,
  });

  report({
    stage: 'ranking',
    status: 'active',
    message: `RANKING ${repositories.length} REPOSITORIES BY CAREER FIT...`,
  });

  // Every discovered repository is ranked from metadata before anything is read.
  const ranked = rankRepositories(attributedRepositories, careerPath);

  report({
    stage: 'ranking',
    status: 'complete',
    message: `RANKED ${ranked.length} REPOSITORIES`,
    stageProgress: 1,
  });

  const outcomes = new Map<string, PortfolioRepositoryOutcome>();
  const queue: GitHubRepository[] = [];

  for (const entry of ranked) {
    const reason = ineligibleReason(entry.repository);

    if (reason) {
      outcomes.set(entry.repository.fullName, {
        repository: entry.repository,
        status: 'skipped',
        skipReason: reason,
      });
      report({
        stage: 'analyzing',
        status: 'active',
        message: `SKIPPED ${entry.repository.name}`,
        repository: { name: entry.repository.name, state: 'skipped', reason },
      });
      continue;
    }

    queue.push(entry.repository);
  }

  report({
    stage: 'analyzing',
    status: 'active',
    message: `QUEUED ${queue.length} REPOSITORIES FOR DEEP ANALYSIS`,
    counters: { queued: queue.length, skipped: outcomes.size },
    stageProgress: 0,
  });

  let completed = 0;
  let deeplyAnalyzed = 0;
  let skipped = outcomes.size;
  // Once GitHub starts refusing requests, further calls only waste the remaining budget.

  await mapWithConcurrency(queue, repositoryConcurrency, async (repository) => {
    if (rateLimited) {
      completed += 1;
      skipped += 1;
      outcomes.set(repository.fullName, {
        repository,
        status: 'skipped',
        skipReason:
          'GitHub rate limit reached before this repository could be read.',
      });
      return;
    }

    report({
      stage: 'analyzing',
      status: 'active',
      message: `ANALYZING ${repository.name}...`,
      repository: { name: repository.name, state: 'analyzing' },
      stageProgress: completed / Math.max(queue.length, 1),
    });

    const key = cacheKey(repository, careerPath);
    const cached = readCache(key);

    try {
      const analysis =
        cached ??
        (await analyzeRepositoryFromGitHub(
          client,
          repository.owner.login,
          repository.name,
          careerPath,
          {
            knownRepository: repository,
            contributionResolution: contributionResolutions.get(
              repository.fullName,
            ),
          },
        ));

      if (!cached) {
        writeCache(key, analysis);
      }

      completed += 1;
      deeplyAnalyzed += 1;
      outcomes.set(repository.fullName, {
        repository,
        status: 'deeply-analyzed',
        analysis,
      });

      report({
        stage: 'analyzing',
        status: 'active',
        message: `${repository.name.toUpperCase()} ✓ ${analysis.rating.score.toFixed(1)}/10 · ${analysis.careerRelevance.score}% CAREER RELEVANCE${cached ? ' (CACHED)' : ''}`,
        repository: {
          name: repository.name,
          state: 'analyzed',
          strength: analysis.rating.score,
        },
        counters: { deeplyAnalyzed, skipped },
        stageProgress: completed / Math.max(queue.length, 1),
      });
    } catch (error) {
      const reason = describeFailure(error);

      if (
        error instanceof GitHubClientError &&
        error.code === 'GITHUB_RATE_LIMITED'
      ) {
        rateLimited = true;
      }

      completed += 1;
      skipped += 1;
      outcomes.set(repository.fullName, {
        repository,
        status: 'skipped',
        skipReason: reason,
      });

      report({
        stage: 'analyzing',
        status: 'active',
        message: `SKIPPED ${repository.name.toUpperCase()} · ${reason.toUpperCase()}`,
        repository: { name: repository.name, state: 'skipped', reason },
        counters: { deeplyAnalyzed, skipped },
        stageProgress: completed / Math.max(queue.length, 1),
      });
    }
  });

  report({
    stage: 'analyzing',
    status: 'complete',
    message: `${deeplyAnalyzed} REPOSITORIES ANALYZED · ${skipped} SKIPPED`,
    counters: { deeplyAnalyzed, skipped },
    stageProgress: 1,
  });

  // Every repository failing is a service problem, not an assessment: reporting a score
  // from nothing would present an outage as if it were a finding.
  if ((queue.length > 0 || rateLimited) && deeplyAnalyzed === 0) {
    throw new GitHubClientError(
      rateLimited
        ? 'GitHub rate limit reached. Add a GITHUB_TOKEN to the API environment and try again.'
        : 'No repository could be analyzed for this portfolio.',
      rateLimited ? 429 : 502,
      rateLimited ? 'GITHUB_RATE_LIMITED' : 'GITHUB_UPSTREAM_ERROR',
    );
  }

  report({
    stage: 'scoring',
    status: 'active',
    message: 'SCORING PORTFOLIO EVIDENCE...',
  });

  const portfolio = buildCareerPortfolioScore({
    careerPath,
    outcomes: ranked.map(
      (entry) =>
        outcomes.get(entry.repository.fullName) ?? {
          repository: entry.repository,
          status: 'metadata-only' as const,
        },
    ),
    rateLimited,
  });

  report({
    stage: 'scoring',
    status: 'complete',
    message: `PORTFOLIO SCORE ${portfolio.score.toFixed(1)}/10 FROM ${deeplyAnalyzed} ANALYZED REPOSITORIES`,
    stageProgress: 1,
  });

  return portfolio;
}

function unavailableContribution(
  username: string,
  error: unknown,
): UserContributionSummary {
  const rateLimited =
    error instanceof GitHubClientError && error.code === 'GITHUB_RATE_LIMITED';
  const reason = rateLimited
    ? 'GitHub rate limit reached before contributions could be verified.'
    : 'GitHub could not verify contributions for this fork.';
  return {
    username,
    outcome: 'unavailable',
    verified: false,
    status: `Skipped — ${reason}`,
    reason,
    commitCount: 0,
    branchCount: 0,
    branchesInspected: 0,
    fileCount: 0,
    additions: 0,
    deletions: 0,
    firstCommitAt: null,
    lastCommitAt: null,
    identityEvidence: [],
    filePaths: [],
    languages: [],
  };
}

function describeFailure(error: unknown): string {
  if (!(error instanceof GitHubClientError)) {
    return 'Analysis failed unexpectedly for this repository.';
  }

  switch (error.code) {
    case 'GITHUB_RATE_LIMITED':
      return 'GitHub rate limit reached before this repository could be read.';
    case 'GITHUB_NOT_FOUND':
      return 'Inaccessible: GitHub returned no tree for the default branch, which usually means the repository is empty.';
    case 'GITHUB_TIMEOUT':
      return 'Timed out while reading this repository, which usually means it is very large.';
    default:
      return 'GitHub could not serve this repository.';
  }
}
