import { describe, expect, it } from 'vitest';
import type { PortfolioProgressEvent } from '@proofly/shared-types';
import {
  applyPortfolioEvent,
  initialPortfolioProgress,
} from './portfolioProgress.js';

function apply(events: PortfolioProgressEvent[]) {
  return events.reduce(applyPortfolioEvent, initialPortfolioProgress);
}

describe('portfolio progress', () => {
  it('tracks repositories through analyzing to their outcome without duplicating them', () => {
    const state = apply([
      {
        stage: 'analyzing',
        status: 'active',
        message: 'ANALYZING proofly...',
        repository: { name: 'proofly', state: 'analyzing' },
      },
      {
        stage: 'analyzing',
        status: 'active',
        message: 'PROOFLY ✓',
        repository: { name: 'proofly', state: 'analyzed', strength: 7.4 },
      },
      {
        stage: 'analyzing',
        status: 'active',
        message: 'SKIPPED old-fork',
        repository: {
          name: 'old-fork',
          state: 'skipped',
          reason: 'Fork: the code is someone else’s work.',
        },
      },
    ]);

    expect(state.repositories).toHaveLength(2);
    expect(state.repositories[0]).toMatchObject({
      name: 'proofly',
      state: 'analyzed',
      strength: 7.4,
    });
    expect(state.repositories[1]?.state).toBe('skipped');
    expect(state.currentRepository).toBeNull();
  });

  it('names the repository currently being read', () => {
    const state = apply([
      {
        stage: 'analyzing',
        status: 'active',
        message: 'ANALYZING finance-dashboard...',
        repository: { name: 'finance-dashboard', state: 'analyzing' },
      },
    ]);

    expect(state.currentRepository).toBe('finance-dashboard');
  });

  it('derives progress from reported repository completion', () => {
    const state = apply([
      {
        stage: 'discovering',
        status: 'complete',
        message: 'DISCOVERED 20',
        counters: { discovered: 20 },
      },
      { stage: 'ranking', status: 'complete', message: 'RANKED 20' },
      {
        stage: 'analyzing',
        status: 'active',
        message: 'ANALYZING...',
        counters: { queued: 20, deeplyAnalyzed: 10 },
        stageProgress: 0.5,
      },
    ]);

    // 6% discovery + 4% ranking + half of the 86% analysis weight.
    expect(state.percent).toBe(53);
    expect(state.counters.discovered).toBe(20);
    expect(state.counters.deeplyAnalyzed).toBe(10);
  });

  it('never walks the bar backwards and only finishes when scoring completes', () => {
    const midway = apply([
      {
        stage: 'analyzing',
        status: 'active',
        message: 'A',
        stageProgress: 0.8,
      },
      {
        stage: 'analyzing',
        status: 'active',
        message: 'B',
        stageProgress: 0.1,
      },
    ]);
    expect(midway.percent).toBe(79);
    expect(midway.percent).toBeLessThan(100);

    const finished = applyPortfolioEvent(midway, {
      stage: 'scoring',
      status: 'complete',
      message: 'PORTFOLIO SCORE 7.4/10',
    });
    expect(finished.percent).toBe(100);
  });

  it('starts empty and understandable', () => {
    expect(initialPortfolioProgress.percent).toBe(0);
    expect(initialPortfolioProgress.repositories).toHaveLength(0);
    expect(initialPortfolioProgress.currentRepository).toBeNull();
  });
});
