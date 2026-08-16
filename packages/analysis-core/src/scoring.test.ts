import { describe, expect, it } from 'vitest';
import type { GitHubRepository } from '@proofly/shared-types';
import { rankRepositories, rankRepository } from './scoring.js';

const baseRepository: GitHubRepository = {
  id: 1,
  name: 'starter',
  fullName: 'octocat/starter',
  description: null,
  htmlUrl: 'https://github.com/octocat/starter',
  homepage: null,
  language: null,
  topics: [],
  stargazersCount: 0,
  forksCount: 0,
  watchersCount: 0,
  openIssuesCount: 0,
  size: 0,
  defaultBranch: 'main',
  licenseName: null,
  pushedAt: null,
  updatedAt: '2026-01-01T00:00:00Z',
  createdAt: '2025-01-01T00:00:00Z',
  archived: false,
  fork: false,
  owner: {
    login: 'octocat',
    avatarUrl: 'https://github.com/images/error/octocat_happy.gif',
    profileUrl: 'https://github.com/octocat',
  },
};

const reactDashboard: GitHubRepository = {
  ...baseRepository,
  id: 2,
  name: 'react-dashboard',
  fullName: 'octocat/react-dashboard',
  description: 'Frontend UI built with react and tailwindcss',
  language: 'TypeScript',
  topics: ['react', 'frontend', 'tailwind'],
  stargazersCount: 4,
  size: 800,
  licenseName: 'MIT License',
  pushedAt: new Date().toISOString(),
};

describe('rankRepositories', () => {
  it('ranks repositories with career-relevant metadata higher', () => {
    const ranked = rankRepositories(
      [baseRepository, reactDashboard],
      'frontend-engineering',
    );

    expect(ranked[0]?.repository.name).toBe('react-dashboard');
    expect(ranked[0]?.relevanceLabel).toBe('High');
    expect(ranked[1]?.relevanceLabel).toBe('Low');
  });

  it('explains a ranking with components that add up to the score', () => {
    const ranked = rankRepository(reactDashboard, 'frontend-engineering');
    const total = ranked.components.reduce(
      (sum, component) => sum + component.earned,
      0,
    );

    expect(Math.round(total)).toBe(ranked.relevanceScore);
    expect(ranked.components.map((component) => component.label)).toEqual([
      'Career skill match',
      'Presentation',
      'Recent activity',
      'Public engagement',
      'Project substance',
    ]);
    expect(ranked.whyThisRanks).toContain('react-dashboard');
    expect(ranked.strongestEvidence).not.toBeNull();
  });

  it('scores the same repository differently per career', () => {
    const asFrontend = rankRepository(reactDashboard, 'frontend-engineering');
    const asQuant = rankRepository(reactDashboard, 'quantitative-development');

    expect(asFrontend.careerRelevanceScore).toBeGreaterThan(
      asQuant.careerRelevanceScore,
    );
    expect(asQuant.topSkills).toHaveLength(0);
  });

  it('does not treat generic words as career evidence', () => {
    const genericRepository: GitHubRepository = {
      ...baseRepository,
      id: 3,
      name: 'cli-module',
      description: 'A src module with a cli and a readme',
      language: 'TypeScript',
    };

    const ranked = rankRepository(
      genericRepository,
      'quantitative-development',
    );

    expect(ranked.careerRelevanceScore).toBe(0);
    expect(ranked.topSkills).toHaveLength(0);
  });

  it('surfaces FinTech signals for a payments repository', () => {
    const paymentsRepository: GitHubRepository = {
      ...baseRepository,
      id: 4,
      name: 'ledger-api',
      description: 'Double-entry ledger service integrating stripe payments',
      language: 'TypeScript',
      topics: ['fintech', 'payments', 'api'],
      size: 500,
      pushedAt: new Date().toISOString(),
    };

    const ranked = rankRepository(paymentsRepository, 'financial-technology');

    expect(ranked.careerRelevanceScore).toBeGreaterThan(0);
    expect(ranked.topSkills.map((skill) => skill.id)).toContain('payments');
    expect(
      ranked.topSkills.find((skill) => skill.id === 'payments')?.matchedSignals,
    ).toContain('"stripe" in description');
  });

  it('ranks a verified fork from attributed files instead of other contributors metadata', () => {
    const verifiedFork: GitHubRepository = {
      ...reactDashboard,
      fork: true,
      userContribution: {
        username: 'octocat',
        outcome: 'verified',
        verified: true,
        status: 'Contribution verified — 2 commits across 1 branch analyzed',
        reason: 'Contribution verified',
        commitCount: 2,
        branchCount: 1,
        branchesInspected: 3,
        fileCount: 1,
        additions: 30,
        deletions: 2,
        firstCommitAt: '2026-01-01T00:00:00Z',
        lastCommitAt: new Date().toISOString(),
        identityEvidence: ['2 commits linked by GitHub to @octocat'],
        filePaths: ['scripts/model.py'],
        languages: ['Python'],
      },
    };

    const ranked = rankRepository(verifiedFork, 'frontend-engineering');

    expect(ranked.careerRelevanceScore).toBe(0);
    expect(ranked.evidence[0]?.value).toContain('Contribution verified');
    expect(
      ranked.components.find((item) => item.label === 'Project substance')
        ?.detail,
    ).not.toContain('fork');
  });
});
