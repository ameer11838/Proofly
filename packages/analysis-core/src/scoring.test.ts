import { describe, expect, it } from 'vitest';
import type { GitHubRepository } from '@proofly/shared-types';
import { rankRepositories } from './scoring.js';

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

describe('rankRepositories', () => {
  it('ranks repositories with career-relevant metadata higher', () => {
    const ranked = rankRepositories(
      [
        baseRepository,
        {
          ...baseRepository,
          id: 2,
          name: 'react-dashboard',
          fullName: 'octocat/react-dashboard',
          description: 'Frontend UI built with React and Tailwind',
          language: 'TypeScript',
          topics: ['react', 'frontend'],
          stargazersCount: 2,
        },
      ],
      'frontend-engineering',
    );

    expect(ranked[0]?.repository.name).toBe('react-dashboard');
    expect(ranked[0]?.relevanceLabel).toBe('High');
  });
});
