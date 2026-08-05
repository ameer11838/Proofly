import { describe, expect, it } from 'vitest';
import type { GitHubRepository } from '@proofly/shared-types';
import { analyzeRepositoryEvidence } from './repositoryAnalysis.js';

const repository: GitHubRepository = {
  id: 1,
  name: 'api-service',
  fullName: 'octocat/api-service',
  description: 'Backend API with tests',
  htmlUrl: 'https://github.com/octocat/api-service',
  homepage: null,
  language: 'TypeScript',
  topics: ['api', 'backend'],
  stargazersCount: 1,
  forksCount: 0,
  watchersCount: 1,
  openIssuesCount: 0,
  size: 42,
  defaultBranch: 'main',
  licenseName: null,
  pushedAt: '2026-01-01T00:00:00Z',
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

describe('analyzeRepositoryEvidence', () => {
  it('returns a repository evidence rating and findings from sampled files', () => {
    const result = analyzeRepositoryEvidence({
      repository,
      careerPath: 'backend-engineering',
      totalFiles: 5,
      files: [
        {
          path: 'README.md',
          size: 200,
          content: '# API Service\n\n## Setup\n\n## Usage\n\n## Tests\n\n## Architecture\n',
        },
        { path: 'package.json', size: 100, content: '{"scripts":{"test":"vitest"}}' },
        { path: 'src/server.ts', size: 100, content: 'export function server() {}' },
        { path: 'src/server.test.ts', size: 100, content: 'import { expect } from "vitest";' },
        { path: '.github/workflows/ci.yml', size: 100, content: 'name: ci' },
      ],
    });

    expect(result.rating.score).toBeGreaterThanOrEqual(7);
    expect(result.findings.some((finding) => finding.category === 'Testing evidence')).toBe(true);
    expect(result.analyzedFiles).toContain('README.md');
  });
});
