import { describe, expect, it, vi } from 'vitest';
import type {
  GitHubRepository,
  GitHubUserProfile,
} from '@proofly/shared-types';
import type { GitHubClient } from '../github/githubClient.js';
import { resolveForkContributions } from './contributionService.js';

const profile: GitHubUserProfile = {
  id: 42,
  login: 'octocat',
  name: 'Octo Cat',
  avatarUrl: '',
  profileUrl: '',
  bio: null,
  company: null,
  location: null,
  blog: null,
  publicRepos: 1,
  followers: 0,
  following: 0,
  createdAt: '2020-01-01T00:00:00Z',
  email: 'octo@example.com',
};

function fork(name: string): GitHubRepository {
  return {
    id: name.length,
    name,
    fullName: `octocat/${name}`,
    description: 'Metadata written by somebody else',
    htmlUrl: `https://github.com/octocat/${name}`,
    homepage: null,
    language: 'TypeScript',
    topics: ['frontend'],
    stargazersCount: 10,
    forksCount: 2,
    watchersCount: 10,
    openIssuesCount: 0,
    size: 500,
    defaultBranch: 'main',
    licenseName: 'MIT',
    pushedAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    createdAt: '2025-01-01T00:00:00Z',
    archived: false,
    fork: true,
    owner: { login: 'octocat', avatarUrl: '', profileUrl: '' },
  };
}

function commit(sha: string, authorLogin: string | null = 'octocat') {
  return {
    sha,
    htmlUrl: `https://github.com/octocat/project/commit/${sha}`,
    message: 'Add verified work',
    author: {
      name: 'Octo Cat',
      email: '42+octocat@users.noreply.github.com',
      date: '2026-01-01T00:00:00Z',
    },
    committer: null,
    authorLogin,
    parentCount: 1,
  };
}

describe('resolveForkContributions', () => {
  it('inspects every branch, deduplicates commits, and keeps only added lines', async () => {
    const listed = vi.fn(
      async (_owner: string, _repo: string, branch: string) =>
        branch === 'main' || branch === 'feature' ? [commit('abc1234')] : [],
    );
    const client = {
      listRepositoryBranches: vi.fn(async () => [
        { name: 'main', headSha: 'head-main' },
        { name: 'feature', headSha: 'head-feature' },
        { name: 'hackathon', headSha: 'head-hackathon' },
      ]),
      listRepositoryCommitsByAuthor: listed,
      getRepositoryCommit: vi.fn(async () => ({
        ...commit('abc1234'),
        files: [
          {
            filename: 'src/owned.ts',
            status: 'modified',
            additions: 2,
            deletions: 1,
            changes: 3,
            patch: [
              '@@ -8,4 +8,5 @@',
              ' const somebodyElsesLine = true;',
              '-oldCall();',
              '+try {',
              '+  ownedCall();',
              ' }',
            ].join('\n'),
          },
        ],
      })),
    } as unknown as GitHubClient;

    const result = await resolveForkContributions(
      client,
      fork('branch-contribution'),
      profile,
    );

    expect(new Set(listed.mock.calls.map((call) => call[2]))).toEqual(
      new Set(['main', 'feature', 'hackathon']),
    );
    expect(result.report.status).toBe(
      'Contribution verified — 1 commit across 2 branches analyzed',
    );
    expect(result.report.branchesInspected).toBe(3);
    expect(result.report.commitCount).toBe(1);
    expect(result.evidenceFiles).toHaveLength(1);
    expect(result.evidenceFiles[0]).toMatchObject({
      path: 'src/owned.ts',
      ref: 'abc1234',
      startLine: 9,
      content: 'try {\n  ownedCall();',
    });
    expect(result.evidenceFiles[0]?.content).not.toContain('somebodyElsesLine');
    expect(result.evidenceFiles[0]?.content).not.toContain('oldCall');
  });

  it('does not treat author names, committer identity, or merge diffs as ownership', async () => {
    const misleadingMerge = {
      ...commit('merge123'),
      author: {
        name: 'octocat',
        email: 'someone-else@example.com',
        date: '2026-01-01T00:00:00Z',
      },
      parentCount: 2,
    };
    const nameOnly = {
      ...commit('name123', null),
      author: {
        name: 'octocat',
        email: 'someone-else@example.com',
        date: '2026-01-01T00:00:00Z',
      },
    };
    const linkedToSomeoneElse = commit('other123', 'teammate');
    const client = {
      listRepositoryBranches: vi.fn(async () => [
        { name: 'main', headSha: 'merge123' },
      ]),
      listRepositoryCommitsByAuthor: vi.fn(async () => [
        misleadingMerge,
        nameOnly,
        linkedToSomeoneElse,
      ]),
      getRepositoryCommit: vi.fn(),
    } as unknown as GitHubClient;

    const result = await resolveForkContributions(
      client,
      fork('unverified-merge-only'),
      profile,
    );

    expect(result.report.verified).toBe(false);
    expect(result.report.status).toBe(
      'Skipped — No contributions from this GitHub user were found.',
    );
    expect(result.evidenceFiles).toEqual([]);
    expect(client.getRepositoryCommit).not.toHaveBeenCalled();
  });
});
