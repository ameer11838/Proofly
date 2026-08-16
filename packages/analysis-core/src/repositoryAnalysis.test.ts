import { describe, expect, it } from 'vitest';
import type { GitHubRepository } from '@proofly/shared-types';
import {
  analyzeRepositoryEvidence,
  ratingLabel,
  type RepositoryFileEvidence,
} from './repositoryAnalysis.js';
import { maxScore, sumPoints } from './scoreModel.js';

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
  size: 420,
  defaultBranch: 'main',
  licenseName: 'MIT License',
  pushedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdAt: '2025-01-01T00:00:00Z',
  archived: false,
  fork: false,
  owner: {
    login: 'octocat',
    avatarUrl: 'https://github.com/images/error/octocat_happy.gif',
    profileUrl: 'https://github.com/octocat',
  },
};

const files: RepositoryFileEvidence[] = [
  {
    path: 'README.md',
    size: 200,
    content:
      '# API Service\n\n## Setup\n\nnpm install\n\n## Usage\n\n```bash\nnpm start\n```\n\n## Architecture\n\nExpress routes call the service layer.\n',
  },
  {
    path: 'package.json',
    size: 120,
    content:
      '{"dependencies":{"express":"^5.0.0","pg":"^8.11.0"},"devDependencies":{"vitest":"^3.0.0"}}',
  },
  {
    path: 'src/server.ts',
    size: 300,
    content: [
      'import express from "express";',
      '',
      'const app = express();',
      '',
      'app.get("/api/users", async (request, response) => {',
      '  try {',
      '    const result = await pool.query("SELECT id, email FROM users WHERE active = true");',
      '    response.status(200).json(result.rows);',
      '  } catch (error) {',
      '    response.status(500).json({ error: "lookup failed" });',
      '  }',
      '});',
    ].join('\n'),
  },
  {
    path: 'src/server.test.ts',
    size: 120,
    content:
      'import { expect, it } from "vitest";\n\nit("serves users", () => {\n  expect(1).toBe(1);\n});\n',
  },
  {
    path: '.github/workflows/ci.yml',
    size: 100,
    content:
      'name: ci\njobs:\n  check:\n    steps:\n      - run: npm test\n      - run: npm run lint\n',
  },
];

const treePaths = files.map((file) => file.path);

function analyze(
  careerPath: Parameters<typeof analyzeRepositoryEvidence>[0]['careerPath'],
) {
  return analyzeRepositoryEvidence({
    repository,
    careerPath,
    files,
    totalFiles: treePaths.length,
    treePaths,
  });
}

describe('analyzeRepositoryEvidence', () => {
  it('uses the portfolio-oriented Starting through Exceptional scale', () => {
    expect(ratingLabel(1)).toBe('Starting');
    expect(ratingLabel(2.9)).toBe('Starting');
    expect(ratingLabel(3)).toBe('Developing');
    expect(ratingLabel(5)).toBe('Solid');
    expect(ratingLabel(7)).toBe('Strong');
    expect(ratingLabel(9)).toBe('Exceptional');
  });

  it('produces a score that its categories add up to', () => {
    const result = analyze('backend-engineering');
    const categoryTotal = sumPoints(
      result.breakdown.categories.map((category) => category.earned),
    );

    expect(result.breakdown.categories).toHaveLength(5);
    expect(categoryTotal).toBe(result.breakdown.score);
    expect(result.rating.score).toBe(result.breakdown.score);
    expect(
      sumPoints(result.breakdown.categories.map((category) => category.max)),
    ).toBe(maxScore);
  });

  it('makes each category the sum of its own signals', () => {
    const result = analyze('backend-engineering');

    for (const category of result.breakdown.categories) {
      expect(sumPoints(category.signals.map((signal) => signal.earned))).toBe(
        category.earned,
      );
      expect(category.earned).toBeLessThanOrEqual(category.max);

      for (const signal of category.signals) {
        expect(signal.earned).toBeLessThanOrEqual(signal.max);
      }
    }
  });

  it('reports project strength and career relevance as separate scores', () => {
    const backend = analyze('backend-engineering');
    const quant = analyze('quantitative-development');

    // The repository is identical, so engineering quality must not move with the career.
    expect(quant.engineering.score).toBe(backend.engineering.score);
    expect(quant.careerRelevance.score).toBeLessThan(
      backend.careerRelevance.score,
    );
    expect(backend.careerRelevance.label).toBe('Backend engineering relevance');
    expect(quant.careerRelevance.label).toBe(
      'Quantitative development relevance',
    );
  });

  it('only quotes code fragments that exist verbatim in the analyzed files', () => {
    const result = analyze('backend-engineering');
    expect(result.codeEvidence.length).toBeGreaterThan(0);

    for (const evidence of result.codeEvidence) {
      const file = files.find((candidate) => candidate.path === evidence.path);
      expect(file).toBeDefined();

      const sourceLines = (file?.content ?? '').split('\n');
      const quoted = evidence.fragment.split('\n');
      expect(evidence.endLine - evidence.startLine + 1).toBe(quoted.length);

      // Fragments are dedented for display, so compare on trimmed content.
      for (const [index, line] of quoted.entries()) {
        expect(sourceLines[evidence.startLine - 1 + index]?.trim()).toBe(
          line.trim(),
        );
      }

      expect(evidence.githubUrl).toContain(`/blob/main/${evidence.path}`);
    }
  });

  it('returns source-backed code quality and attributable development activity', () => {
    const result = analyzeRepositoryEvidence({
      repository,
      careerPath: 'backend-engineering',
      files,
      totalFiles: treePaths.length,
      treePaths,
      commitHistoryScope: 'default branch (main)',
      commitHistory: [
        {
          sha: 'a'.repeat(40),
          message: 'Add guarded user lookup endpoint',
          committedAt: '2026-08-01T00:00:00Z',
          htmlUrl: `${repository.htmlUrl}/commit/${'a'.repeat(40)}`,
        },
      ],
    });

    expect(result.codeQuality.dimensions).toHaveLength(5);
    expect(result.codeQuality.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/server.ts',
          title: 'Explicit failure path',
          kind: 'strength',
        }),
      ]),
    );
    expect(result.developmentActivity.commitCount).toBe(1);
    expect(result.developmentActivity.scope).toBe('default branch (main)');
    expect(result.developmentActivity.commits[0]?.quality).toBe('clear');
  });

  it('grounds career relevance in dependencies and code rather than generic words', () => {
    const result = analyze('backend-engineering');
    const apiSkill = result.careerRelevance.skills.find(
      (skill) => skill.id === 'api-design',
    );
    const persistence = result.careerRelevance.skills.find(
      (skill) => skill.id === 'data-persistence',
    );

    expect(apiSkill?.strength).toBe('strong');
    expect(
      apiSkill?.matchedSignals.some((signal) =>
        signal.includes('src/server.ts'),
      ),
    ).toBe(true);
    expect(persistence?.strength).toBe('strong');
  });

  it('never promises more improvement than the model can award', () => {
    const result = analyze('quantitative-development');
    const promised = sumPoints(
      result.improvementPlan.actions.map((action) => action.points),
    );

    expect(result.improvementPlan.currentScore).toBe(result.breakdown.score);
    expect(result.improvementPlan.potentialScore).toBe(
      sumPoints([result.improvementPlan.currentScore, promised]),
    );
    expect(result.improvementPlan.potentialScore).toBeLessThanOrEqual(maxScore);

    for (const action of result.improvementPlan.actions) {
      const category = result.breakdown.categories.find(
        (entry) => entry.key === action.category,
      );
      expect(action.points).toBeLessThanOrEqual(
        (category?.max ?? 0) - (category?.earned ?? 0) + 0.001,
      );
    }
  });

  it('recommends fixes that name real files', () => {
    const result = analyzeRepositoryEvidence({
      repository,
      careerPath: 'backend-engineering',
      files: files.filter(
        (file) =>
          !file.path.includes('test') && !file.path.includes('workflows'),
      ),
      totalFiles: 3,
      treePaths: ['README.md', 'package.json', 'src/server.ts'],
    });

    const testAction = result.improvementPlan.actions.find(
      (action) => action.title === 'Add automated tests',
    );
    expect(testAction?.detail).toContain('src/server.ts');

    expect(
      result.breakdown.categories
        .find((category) => category.key === 'project-quality')
        ?.signals.some((signal) => signal.label === 'CI/CD and automation'),
    ).toBe(true);
  });

  it('keeps a substantive student project solid without tests or CI', () => {
    const result = analyzeRepositoryEvidence({
      repository,
      careerPath: 'backend-engineering',
      files: files.filter(
        (file) =>
          !file.path.includes('test') && !file.path.includes('workflows'),
      ),
      totalFiles: 3,
      treePaths: ['README.md', 'package.json', 'src/server.ts'],
    });
    const quality = result.breakdown.categories.find(
      (category) => category.key === 'project-quality',
    );

    expect(result.rating.score).toBeGreaterThanOrEqual(5);
    expect(result.rating.score).toBeLessThan(9);
    expect(quality?.earned).toBeGreaterThan(0);
    expect(quality?.earned).toBeLessThan(quality?.max ?? 0);
  });

  it('keeps the legacy findings and file counters populated', () => {
    const result = analyze('backend-engineering');

    expect(
      result.findings.some((finding) => finding.category === 'Project Quality'),
    ).toBe(true);
    expect(result.analyzedFiles).toContain('README.md');
    expect(result.fileReport.analyzedCount).toBe(files.length);
  });
});
