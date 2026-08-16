import { describe, expect, it } from 'vitest';
import type {
  GitHubRepository,
  RepositoryAnalysisResponse,
} from '@proofly/shared-types';
import {
  buildCareerPortfolioScore,
  careerEvidenceStrength,
  type PortfolioRepositoryOutcome,
} from './portfolioScore.js';

function repository(
  name: string,
  overrides: Partial<GitHubRepository> = {},
): GitHubRepository {
  return {
    id: name.length,
    name,
    fullName: `octocat/${name}`,
    description: 'Frontend dashboard built with react and tailwindcss',
    htmlUrl: `https://github.com/octocat/${name}`,
    homepage: null,
    language: 'TypeScript',
    topics: ['react', 'frontend'],
    stargazersCount: 2,
    forksCount: 0,
    watchersCount: 2,
    openIssuesCount: 0,
    size: 500,
    defaultBranch: 'main',
    licenseName: 'MIT License',
    pushedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdAt: '2025-01-01T00:00:00Z',
    archived: false,
    fork: false,
    owner: { login: 'octocat', avatarUrl: '', profileUrl: '' },
    ...overrides,
  };
}

/** Minimal analysis shaped only with the fields the portfolio score reads. */
function analysis(
  name: string,
  relevance: number,
  engineering: number,
  prooflyScore: number,
): RepositoryAnalysisResponse {
  return {
    repository: repository(name),
    careerPath: 'frontend-engineering',
    rating: {
      score: prooflyScore,
      label: 'Strong',
      summary: '',
      reasoning: [],
    },
    breakdown: {
      score: prooflyScore,
      maxScore: 10,
      categories: [
        {
          key: 'documentation',
          label: 'Documentation',
          description: '',
          earned: 1.8,
          max: 2,
          signals: [],
        },
        {
          key: 'testing',
          label: 'Testing',
          description: '',
          earned: 0.2,
          max: 1.8,
          signals: [],
        },
      ],
    },
    engineering: {
      score: engineering,
      band: 'Moderate',
      summary: '',
      categories: [],
    },
    careerRelevance: {
      careerPath: 'frontend-engineering',
      label: 'Frontend engineering relevance',
      score: relevance,
      band: 'Strong',
      summary: '',
      skills: [
        {
          id: 'component-architecture',
          label: 'Component architecture',
          description: '',
          strength: 'strong',
          weight: 3,
          matchedSignals: [],
          sources: [],
          rationale: '',
        },
        {
          id: 'accessibility',
          label: 'Accessibility',
          description: '',
          strength: 'missing',
          weight: 2,
          matchedSignals: [],
          sources: [],
          rationale: '',
        },
      ],
    },
    codeEvidence: [],
    improvementPlan: {
      currentScore: prooflyScore,
      potentialScore: 9,
      maxScore: 10,
      actions: [],
    },
    fileReport: {
      totalFiles: 10,
      analyzedCount: 5,
      ignoredCount: 5,
      files: [],
      ignoredReasons: [],
      ignoredListTruncated: false,
    },
    findings: [],
    suggestions: [],
    analyzedFiles: [],
    ignoredFilesCount: 5,
  };
}

function analyzed(
  name: string,
  relevance: number,
  engineering: number,
  score = 7,
): PortfolioRepositoryOutcome {
  return {
    repository: repository(name),
    status: 'deeply-analyzed',
    analysis: analysis(name, relevance, engineering, score),
  };
}

function skipped(name: string, reason: string): PortfolioRepositoryOutcome {
  return {
    repository: repository(name),
    status: 'skipped',
    skipReason: reason,
  };
}

const career = 'frontend-engineering' as const;

describe('buildCareerPortfolioScore', () => {
  it('reports coverage across every discovered repository', () => {
    const result = buildCareerPortfolioScore({
      careerPath: career,
      outcomes: [
        analyzed('a', 80, 75),
        analyzed('b', 70, 70),
        skipped('c', 'No contributions from this GitHub user were found.'),
        skipped('d', 'No contributions from this GitHub user were found.'),
        skipped('e', 'Empty repository: GitHub reports no content to read.'),
      ],
    });

    expect(result.coverage.discovered).toBe(5);
    expect(result.coverage.metadataAnalyzed).toBe(5);
    expect(result.coverage.deeplyAnalyzed).toBe(2);
    expect(result.coverage.skipped).toBe(3);
    expect(result.coverage.skipReasons).toEqual([
      {
        reason: 'No contributions from this GitHub user were found.',
        count: 2,
      },
      {
        reason: 'Empty repository: GitHub reports no content to read.',
        count: 1,
      },
    ]);
    expect(result.summary).toContain('2 deeply analyzed repositories out of 5');
  });

  it('scales past three repositories', () => {
    const outcomes = Array.from({ length: 40 }, (_, index) =>
      analyzed(`repo-${index}`, 40 + (index % 50), 40 + (index % 40)),
    );

    const result = buildCareerPortfolioScore({ careerPath: career, outcomes });

    expect(result.coverage.deeplyAnalyzed).toBe(40);
    expect(result.contributors).toHaveLength(40);
    // Only the strongest ten carry the score; the rest still shape breadth.
    expect(
      result.contributors.filter((entry) => entry.contribution > 0),
    ).toHaveLength(10);
  });

  it('is not destroyed by a long tail of weak repositories', () => {
    const strong = [
      analyzed('a', 88, 82),
      analyzed('b', 84, 80),
      analyzed('c', 80, 78),
    ];
    const weakTail = Array.from({ length: 30 }, (_, index) =>
      analyzed(`weak-${index}`, 5, 8, 1.5),
    );

    const strongOnly = buildCareerPortfolioScore({
      careerPath: career,
      outcomes: strong,
    });
    const withTail = buildCareerPortfolioScore({
      careerPath: career,
      outcomes: [...strong, ...weakTail],
    });

    expect(withTail.score).toBeGreaterThanOrEqual(strongOnly.score - 0.5);
    expect(withTail.contributors[0]?.name).toBe('a');
  });

  it('sorts contributions by impact and explains every repository', () => {
    const result = buildCareerPortfolioScore({
      careerPath: career,
      outcomes: [
        skipped('forked', 'No contributions from this GitHub user were found.'),
        analyzed('weak', 20, 25, 3),
        analyzed('strong', 90, 85, 8.8),
      ],
    });

    const contributions = result.contributors.map(
      (entry) => entry.contribution,
    );
    expect(contributions).toEqual([...contributions].sort((a, b) => b - a));
    expect(result.contributors[0]?.name).toBe('strong');

    for (const contributor of result.contributors) {
      expect(contributor.explanation.length).toBeGreaterThan(0);
    }

    const strongest = result.contributors[0];
    expect(strongest?.status).toBe('deeply-analyzed');
    // Reported on a 0-10 scale, as the contributions table displays them.
    expect(strongest?.careerRelevance).toBe(9);
    expect(strongest?.engineering).toBe(8.5);
    expect(strongest?.strength).toBeCloseTo(8.8, 1);

    const fork = result.contributors.find((entry) => entry.name === 'forked');
    expect(fork?.status).toBe('skipped');
    expect(fork?.contribution).toBe(0);
    expect(fork?.careerRelevance).toBeNull();
    expect(fork?.explanation).toContain(
      'No contributions from this GitHub user',
    );
  });

  it('weights the strongest repository most heavily', () => {
    const result = buildCareerPortfolioScore({
      careerPath: career,
      outcomes: [analyzed('weak', 20, 30, 3), analyzed('strong', 90, 85, 8.8)],
    });

    const contributions = result.contributors.map(
      (entry) => entry.contribution,
    );
    expect(result.contributors[0]?.name).toBe('strong');
    expect(contributions[0]).toBeGreaterThan(contributions[1] ?? 0);
    expect(contributions.reduce((sum, value) => sum + value, 0)).toBeCloseTo(
      1,
      1,
    );
  });

  it('rewards breadth of strong repositories without letting it dominate', () => {
    const two = buildCareerPortfolioScore({
      careerPath: career,
      outcomes: [analyzed('a', 80, 75), analyzed('b', 78, 70)],
    });
    const five = buildCareerPortfolioScore({
      careerPath: career,
      outcomes: [
        analyzed('a', 80, 75),
        analyzed('b', 78, 70),
        analyzed('c', 76, 72),
        analyzed('d', 75, 70),
        analyzed('e', 74, 71),
      ],
    });

    expect(five.score).toBeGreaterThan(two.score);
    expect(five.score - two.score).toBeLessThanOrEqual(0.8);
  });

  it('stays inside the 1-10 range at both extremes', () => {
    const floor = buildCareerPortfolioScore({
      careerPath: career,
      outcomes: [analyzed('a', 0, 0, 1)],
    });
    const ceiling = buildCareerPortfolioScore({
      careerPath: career,
      outcomes: Array.from({ length: 6 }, (_, index) =>
        analyzed(`a-${index}`, 100, 100, 10),
      ),
    });

    expect(floor.score).toBeGreaterThanOrEqual(1);
    expect(ceiling.score).toBeLessThanOrEqual(10);
  });

  it('says so plainly when nothing could be read', () => {
    const result = buildCareerPortfolioScore({
      careerPath: career,
      outcomes: [
        skipped(
          'a',
          'GitHub rate limit reached before this repository could be read.',
        ),
      ],
      rateLimited: true,
    });

    expect(result.coverage.deeplyAnalyzed).toBe(0);
    expect(result.coverage.rateLimited).toBe(true);
    expect(result.summary).toMatch(/could be read file-by-file/i);
    expect(result.score).toBe(1);
  });

  it('explains what drives the score', () => {
    const result = buildCareerPortfolioScore({
      careerPath: 'financial-technology',
      outcomes: [analyzed('ledger', 80, 75, 8)],
    });

    expect(result.label).toBe('Overall FinTech score');
    expect(result.strongestEvidence).toContain('TypeScript');
    expect(result.strongestEvidence).toContain('Component architecture');
    expect(result.mainGaps).toContain('testing');
    expect(result.mainGaps).toContain('accessibility');
    expect(result.disclaimer).toMatch(/not a hiring score/i);
  });

  it('blends career relevance and engineering evidence', () => {
    expect(careerEvidenceStrength(analysis('a', 100, 0, 5))).toBeCloseTo(
      5.5,
      5,
    );
    expect(careerEvidenceStrength(analysis('b', 0, 100, 5))).toBeCloseTo(
      4.5,
      5,
    );
  });
});
