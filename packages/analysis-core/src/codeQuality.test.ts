import { describe, expect, it } from 'vitest';
import type { GitHubRepository } from '@proofly/shared-types';
import {
  analyzeCodeQuality,
  analyzeDevelopmentActivity,
} from './codeQuality.js';

const repository: GitHubRepository = {
  id: 1,
  name: 'evidence-app',
  fullName: 'student/evidence-app',
  description: null,
  htmlUrl: 'https://github.com/student/evidence-app',
  homepage: null,
  language: 'TypeScript',
  topics: [],
  stargazersCount: 0,
  forksCount: 0,
  watchersCount: 0,
  openIssuesCount: 0,
  size: 20,
  defaultBranch: 'main',
  licenseName: null,
  pushedAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  createdAt: '2026-07-01T00:00:00Z',
  archived: false,
  fork: false,
  owner: { login: 'student', avatarUrl: '', profileUrl: '' },
};

describe('code quality analysis', () => {
  it('anchors supported strengths and improvements to real source lines', () => {
    const report = analyzeCodeQuality(repository, [
      {
        path: 'src/github.ts',
        size: 180,
        content: [
          'export async function load(url: string) {',
          '  const token = process.env.GITHUB_TOKEN;',
          '  const response = await fetch(url);',
          '  return response.json();',
          '}',
          '',
          'export function parse(value: any) {',
          '  return value;',
          '}',
        ].join('\n'),
      },
    ]);

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Environment-driven configuration',
          kind: 'strength',
          path: 'src/github.ts',
          startLine: 1,
        }),
        expect.objectContaining({
          title: 'HTTP response is not validated nearby',
          kind: 'improvement',
          severity: 'High',
        }),
        expect.objectContaining({ title: 'Broad type bypass' }),
      ]),
    );
    expect(report.dimensions).toHaveLength(5);
    expect(report.score).toBeGreaterThan(0);
  });

  it('evaluates message clarity without rewarding commit count alone', () => {
    const activity = analyzeDevelopmentActivity([
      {
        sha: 'a'.repeat(40),
        message: 'update',
        committedAt: '2026-08-01T00:00:00Z',
        htmlUrl: 'https://github.com/student/evidence-app/commit/a',
      },
      {
        sha: 'b'.repeat(40),
        message: 'Add response validation to GitHub client',
        committedAt: '2026-08-02T00:00:00Z',
        htmlUrl: 'https://github.com/student/evidence-app/commit/b',
      },
    ]);

    expect(activity.commitCount).toBe(2);
    expect(activity.meaningfulCommitCount).toBe(1);
    expect(activity.weakMessageCount).toBe(1);
    expect(activity.commits[1]?.reason).toMatch(/vague/i);
    expect(activity.summary).toMatch(/not a scoring target/i);
  });
});
