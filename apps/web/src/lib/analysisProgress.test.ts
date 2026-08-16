import { describe, expect, it } from 'vitest';
import type { AnalysisProgressEvent } from '@proofly/shared-types';
import {
  applyProgressEvent,
  initialAnalysisProgress,
} from './analysisProgress.js';

function apply(events: AnalysisProgressEvent[]) {
  return events.reduce(applyProgressEvent, initialAnalysisProgress);
}

describe('analysis progress', () => {
  it('starts at zero and only advances when the server reports work', () => {
    expect(initialAnalysisProgress.percent).toBe(0);
    expect(
      initialAnalysisProgress.stages.every(
        (stage) => stage.status === 'pending',
      ),
    ).toBe(true);

    const state = apply([
      {
        stage: 'fetching-repository',
        status: 'active',
        message: 'FETCHING...',
        stageProgress: 0,
      },
    ]);

    // An active stage with no measured sub-progress must not invent any.
    expect(state.percent).toBe(0);
    expect(state.stages[0]?.status).toBe('active');
  });

  it('derives the percentage from stage weights and reported sub-progress', () => {
    const afterFetch = apply([
      {
        stage: 'fetching-repository',
        status: 'complete',
        message: 'TREE OK',
        stageProgress: 1,
      },
    ]);
    expect(afterFetch.percent).toBe(30);

    const halfwayThroughFiles = apply([
      { stage: 'fetching-repository', status: 'complete', message: 'TREE OK' },
      {
        stage: 'inspecting-code',
        status: 'active',
        message: 'READ src/app.ts',
        stageProgress: 0.5,
        counters: { filesInspected: 6, filesSelected: 12 },
      },
    ]);

    // 30% for fetching plus half of the 55% inspection weight, which lands a hair under
    // 57.5 in floating point and therefore rounds down.
    expect(halfwayThroughFiles.percent).toBe(57);
    expect(halfwayThroughFiles.counters.filesInspected).toBe(6);
  });

  it('never moves the bar backwards', () => {
    const state = apply([
      {
        stage: 'inspecting-code',
        status: 'active',
        message: 'READ a.ts',
        stageProgress: 0.9,
      },
      {
        stage: 'inspecting-code',
        status: 'active',
        message: 'READ b.ts',
        stageProgress: 0.2,
      },
    ]);

    expect(state.percent).toBe(80);
  });

  it('treats earlier stages as finished once a later one reports', () => {
    const state = apply([
      { stage: 'scoring', status: 'active', message: 'SCORING...' },
    ]);

    expect(
      state.stages.slice(0, 4).every((stage) => stage.status === 'complete'),
    ).toBe(true);
    expect(state.stages[4]?.status).toBe('active');
    expect(state.stages[5]?.status).toBe('pending');
  });

  it('reaches 100 only when the final stage completes', () => {
    const state = apply([
      { stage: 'building-report', status: 'active', message: 'BUILDING...' },
    ]);
    expect(state.percent).toBeLessThan(100);

    const finished = applyProgressEvent(state, {
      stage: 'building-report',
      status: 'complete',
      message: 'REPORT READY',
    });
    expect(finished.percent).toBe(100);
    expect(finished.activeStage).toBeNull();
  });

  it('collects real evidence flashes newest first and caps the log', () => {
    const state = apply([
      {
        stage: 'extracting-evidence',
        status: 'active',
        message: 'CODE EVIDENCE FOUND: REACT HOOK USAGE',
        evidence: {
          label: 'Component architecture',
          detected: 'React hook usage',
          path: 'src/App.tsx',
          startLine: 12,
          endLine: 18,
        },
      },
      {
        stage: 'extracting-evidence',
        status: 'active',
        message: 'CODE EVIDENCE FOUND: HTTP CLIENT CALL',
        evidence: {
          label: 'Client data fetching',
          detected: 'HTTP client call',
          path: 'src/api.ts',
          startLine: 4,
          endLine: 9,
        },
      },
    ]);

    expect(state.evidence[0]?.detected).toBe('HTTP client call');
    expect(state.evidence).toHaveLength(2);
    expect(state.log.at(-1)?.message).toContain('HTTP CLIENT CALL');
  });

  it('keeps the log bounded during a long analysis', () => {
    const events: AnalysisProgressEvent[] = Array.from(
      { length: 80 },
      (_, index) => ({
        stage: 'inspecting-code' as const,
        status: 'active' as const,
        message: `READ file-${index}.ts`,
      }),
    );

    expect(apply(events).log.length).toBeLessThanOrEqual(40);
  });
});
