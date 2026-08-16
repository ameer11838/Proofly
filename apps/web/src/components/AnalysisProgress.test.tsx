import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AnalysisProgressEvent } from '@proofly/shared-types';
import { AnalysisProgress } from './AnalysisProgress.js';
import {
  applyProgressEvent,
  initialAnalysisProgress,
} from '../lib/analysisProgress.js';

function stateFrom(events: AnalysisProgressEvent[]) {
  return events.reduce(applyProgressEvent, initialAnalysisProgress);
}

const midAnalysis = stateFrom([
  {
    stage: 'fetching-repository',
    status: 'complete',
    message: 'TREE OK · 240 FILE(S)',
  },
  {
    stage: 'inspecting-code',
    status: 'active',
    message: 'READ src/services/github.ts',
    file: 'src/services/github.ts',
    stageProgress: 0.5,
    counters: { filesInspected: 12, filesSelected: 24, dependencies: 9 },
  },
  {
    stage: 'extracting-evidence',
    status: 'active',
    message: 'CODE EVIDENCE FOUND: HTTP CLIENT CALL',
    evidence: {
      label: 'API and service design',
      detected: 'HTTP client call',
      path: 'src/services/github.ts',
      startLine: 42,
      endLine: 49,
    },
  },
]);

describe('AnalysisProgress', () => {
  it('shows the numbered stages with the current one described', () => {
    render(
      <AnalysisProgress
        state={midAnalysis}
        repositoryFullName="octocat/react-dashboard"
        careerLabel="Software engineering"
      />,
    );

    expect(screen.getByText('Analyzing repository')).toBeInTheDocument();
    expect(screen.getByText('FETCHING REPOSITORY')).toBeInTheDocument();
    expect(screen.getByText('EXTRACTING EVIDENCE')).toBeInTheDocument();
    expect(screen.getByText('BUILDING REPORT')).toBeInTheDocument();
    expect(
      screen.getByText(
        /finding code fragments that demonstrate technical skills/i,
      ),
    ).toBeInTheDocument();
  });

  it('reports a progress value that matches the reported stages', () => {
    render(
      <AnalysisProgress
        state={midAnalysis}
        repositoryFullName="octocat/react-dashboard"
        careerLabel="Software engineering"
      />,
    );

    const bar = screen.getByRole('progressbar', { name: /analysis progress/i });
    expect(bar).toHaveAttribute('aria-valuenow', String(midAnalysis.percent));
    expect(screen.getByText(`${midAnalysis.percent}%`)).toBeInTheDocument();
  });

  it('surfaces real file names, counters, and evidence as they arrive', () => {
    render(
      <AnalysisProgress
        state={midAnalysis}
        repositoryFullName="octocat/react-dashboard"
        careerLabel="Software engineering"
      />,
    );

    expect(screen.getByText('READ src/services/github.ts')).toBeInTheDocument();
    expect(screen.getByText('Evidence found')).toBeInTheDocument();
    expect(screen.getByText('HTTP client call')).toBeInTheDocument();
    expect(
      screen.getByText('src/services/github.ts : 42–49'),
    ).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('files inspected')).toBeInTheDocument();
  });

  it('switches to the completion summary when the report is ready', () => {
    render(
      <AnalysisProgress
        state={midAnalysis}
        repositoryFullName="octocat/react-dashboard"
        careerLabel="Software engineering"
        completion={{
          filesAnalyzed: 18,
          evidenceSignals: 11,
          careerSkills: 4,
          score: 7.4,
        }}
      />,
    );

    expect(screen.getByText('Analysis complete')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('files analyzed')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('evidence signals')).toBeInTheDocument();
    expect(screen.getByText('7.4')).toBeInTheDocument();
  });

  it('stays understandable with no events yet', () => {
    render(
      <AnalysisProgress
        state={initialAnalysisProgress}
        repositoryFullName="octocat/react-dashboard"
        careerLabel="Software engineering"
      />,
    );

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    expect(screen.getByText(/awaiting first response/i)).toBeInTheDocument();
  });
});
