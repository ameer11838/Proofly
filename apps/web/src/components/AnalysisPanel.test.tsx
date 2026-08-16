import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { RepositoryAnalysisResponse } from '@proofly/shared-types';
import { AnalysisPanel } from './AnalysisPanel.js';

const fragment = [
  'def run(prices):',
  '    returns = prices.pct_change().dropna()',
  '    return returns',
].join('\n');

const analysis: RepositoryAnalysisResponse = {
  repository: {
    id: 1,
    name: 'vol-surface',
    fullName: 'q/vol-surface',
    description: 'Volatility surface fitting',
    htmlUrl: 'https://github.com/q/vol-surface',
    homepage: null,
    language: 'Python',
    topics: ['quant'],
    stargazersCount: 3,
    forksCount: 1,
    watchersCount: 3,
    openIssuesCount: 0,
    size: 900,
    defaultBranch: 'main',
    licenseName: null,
    pushedAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    createdAt: '2025-01-01T00:00:00Z',
    archived: false,
    fork: false,
    owner: { login: 'q', avatarUrl: '', profileUrl: '' },
  },
  careerPath: 'quantitative-development',
  rating: {
    score: 3.5,
    label: 'Early',
    summary: 'vol-surface scores 3.5/10.',
    reasoning: ['Documentation: 0.6/2.0 — README present.'],
  },
  breakdown: {
    score: 3.5,
    maxScore: 10,
    categories: [
      {
        key: 'documentation',
        label: 'Documentation',
        description: 'Can a reader understand this project?',
        earned: 0.6,
        max: 2,
        signals: [
          {
            label: 'README present',
            earned: 0.6,
            max: 0.6,
            detail: 'README.md was found and read.',
            evidence: [{ kind: 'file', label: 'README', path: 'README.md' }],
          },
          {
            label: 'Setup instructions',
            earned: 0,
            max: 0.4,
            detail: 'No installation section was found.',
            evidence: [],
          },
        ],
      },
    ],
  },
  engineering: {
    score: 28,
    band: 'Limited',
    summary: 'Engineering evidence scores 2.2 of 7.8 points.',
    categories: [
      'documentation',
      'testing',
      'ci-automation',
      'code-structure',
      'project-completeness',
    ],
  },
  careerRelevance: {
    careerPath: 'quantitative-development',
    label: 'Quantitative development relevance',
    score: 57,
    band: 'Moderate',
    summary: '4 of 10 skills are backed by strong evidence.',
    skills: [
      {
        id: 'time-series',
        label: 'Time-series analysis',
        description: 'Lagged, windowed, and time-indexed analysis.',
        strength: 'strong',
        weight: 3,
        matchedSignals: ['Time-series transformation in src/backtest.py:4'],
        sources: [
          {
            kind: 'file',
            label: 'Time-series transformation',
            path: 'src/backtest.py',
            line: 4,
          },
        ],
        rationale: 'Source code uses time-series analysis directly.',
      },
      {
        id: 'sql-data-access',
        label: 'SQL and data access',
        description: 'Pulling analysis inputs from a database.',
        strength: 'missing',
        weight: 1.5,
        matchedSignals: [],
        sources: [],
        rationale:
          'Nothing in the analyzed files demonstrates sql and data access.',
      },
    ],
  },
  codeEvidence: [
    {
      id: 'time-series-0',
      path: 'src/backtest.py',
      startLine: 3,
      endLine: 5,
      matchOffset: 2,
      language: 'python',
      fragment,
      detected: 'Time-series transformation',
      why: 'Window and lag operations are specific to time-series analysis.',
      skillId: 'time-series',
      skillLabel: 'Time-series analysis',
      category: 'career-relevance',
      scoreImpact: 'Raises the Time-series analysis skill to strong evidence.',
      githubUrl:
        'https://github.com/q/vol-surface/blob/main/src/backtest.py#L3-L5',
    },
  ],
  improvementPlan: {
    currentScore: 3.5,
    potentialScore: 7.2,
    maxScore: 10,
    actions: [
      {
        id: 'testing-tests-exist',
        title: 'Add automated tests',
        detail:
          'The repository contains substantial logic in src/surface.py, but no test file was detected.',
        category: 'testing',
        points: 0.8,
      },
    ],
  },
  fileReport: {
    totalFiles: 30,
    analyzedCount: 2,
    ignoredCount: 28,
    files: [
      {
        path: 'README.md',
        status: 'analyzed',
        reason: 'README: the primary project explanation.',
        sizeBytes: 100,
      },
      {
        path: 'assets/logo.png',
        status: 'ignored',
        reason: 'Not a readable text or source file (.png).',
        sizeBytes: 40_000,
      },
    ],
    ignoredReasons: [
      { reason: 'Not a readable text or source file (.png).', count: 28 },
    ],
    ignoredListTruncated: false,
  },
  findings: [
    {
      category: 'Testing',
      importance: 'High',
      explanation: 'No checks passed.',
      evidence: [],
      recommendation: 'Add unit tests covering src/surface.py.',
      careerRelevance: 'Testing contributes up to 1.8 points.',
    },
  ],
  suggestions: ['Add unit tests covering src/surface.py.'],
  analyzedFiles: ['README.md', 'src/backtest.py'],
  ignoredFilesCount: 28,
};

describe('AnalysisPanel', () => {
  it('leads with the score and separates engineering from career relevance', () => {
    render(<AnalysisPanel analysis={analysis} />);

    expect(screen.getAllByText(/proofly score/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('3.5').length).toBeGreaterThan(0);
    expect(screen.getByText('Engineering evidence')).toBeInTheDocument();
    expect(screen.getByText('28%')).toBeInTheDocument();
    expect(
      screen.getAllByText('Quantitative development relevance').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('57%').length).toBeGreaterThan(0);
  });

  it('shows the category breakdown adding up to the score', () => {
    render(<AnalysisPanel analysis={analysis} />);

    expect(screen.getByText('Documentation')).toBeInTheDocument();
    expect(screen.getByText('0.6/2.0')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('renders the verbatim code fragment with line numbers and a GitHub link', async () => {
    render(<AnalysisPanel analysis={analysis} />);

    await userEvent.click(screen.getByText('Code evidence'));
    await userEvent.click(screen.getByText('src/backtest.py'));

    // Line numbers start at the fragment's real position in the file.
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/pct_change/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /view on github/i }),
    ).toHaveAttribute(
      'href',
      'https://github.com/q/vol-surface/blob/main/src/backtest.py#L3-L5',
    );
  });

  it('shows the improvement plan without promising more than the model awards', async () => {
    render(<AnalysisPanel analysis={analysis} />);

    await userEvent.click(screen.getByText('Improve this repo'));

    expect(screen.getByText('+0.8')).toBeInTheDocument();
    expect(screen.getByText('Add automated tests')).toBeInTheDocument();
    expect(screen.getAllByText(/src\/surface\.py/).length).toBeGreaterThan(0);
  });

  it('lets the user inspect analyzed and ignored files', async () => {
    render(<AnalysisPanel analysis={analysis} />);

    await userEvent.click(screen.getByText('Files Proofly inspected'));
    expect(screen.getByRole('link', { name: 'README.md' })).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /ignored \(28\)/i }),
    );
    expect(
      screen.getByRole('link', { name: 'assets/logo.png' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'README.md' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/not a readable text or source file/i).length,
    ).toBeGreaterThan(0);
  });
});
