import {
  portfolioStages,
  type PortfolioProgressEvent,
  type PortfolioRepositoryState,
  type PortfolioStage,
} from '@proofly/shared-types';

export type StageStatus = 'pending' | 'active' | 'complete';

export interface PortfolioStageState {
  stage: PortfolioStage;
  status: StageStatus;
  progress: number;
}

export interface PortfolioRepositoryRow {
  name: string;
  state: PortfolioRepositoryState;
  reason?: string;
  strength?: number;
}

export interface PortfolioLogLine {
  id: number;
  message: string;
}

export interface PortfolioProgressState {
  stages: PortfolioStageState[];
  percent: number;
  log: PortfolioLogLine[];
  counters: {
    discovered?: number;
    queued?: number;
    deeplyAnalyzed?: number;
    skipped?: number;
  };
  /** Repositories in the order they resolved, newest last. */
  repositories: PortfolioRepositoryRow[];
  currentRepository: string | null;
  started: boolean;
}

/**
 * Reading repositories is essentially all of the elapsed time; discovery, ranking, and
 * scoring are one API call and two in-memory passes.
 */
const stageWeights: Record<PortfolioStage, number> = {
  discovering: 0.06,
  ranking: 0.04,
  analyzing: 0.86,
  scoring: 0.04,
};

const maxLogLines = 60;

export const initialPortfolioProgress: PortfolioProgressState = {
  stages: portfolioStages.map((stage) => ({
    stage,
    status: 'pending',
    progress: 0,
  })),
  percent: 0,
  log: [],
  counters: {},
  repositories: [],
  currentRepository: null,
  started: false,
};

export type PortfolioProgressAction =
  { type: 'reset' } | { type: 'progress'; event: PortfolioProgressEvent };

export function portfolioProgressReducer(
  state: PortfolioProgressState,
  action: PortfolioProgressAction,
): PortfolioProgressState {
  return action.type === 'reset'
    ? initialPortfolioProgress
    : applyPortfolioEvent(state, action.event);
}

export function applyPortfolioEvent(
  state: PortfolioProgressState,
  event: PortfolioProgressEvent,
): PortfolioProgressState {
  const eventIndex = portfolioStages.indexOf(event.stage);

  const stages = state.stages.map((entry, index): PortfolioStageState => {
    if (index < eventIndex) {
      return { ...entry, status: 'complete', progress: 1 };
    }

    if (index > eventIndex) {
      return entry;
    }

    return {
      ...entry,
      status: event.status === 'complete' ? 'complete' : 'active',
      progress:
        event.status === 'complete'
          ? 1
          : Math.max(entry.progress, event.stageProgress ?? entry.progress),
    };
  });

  const repositories = event.repository
    ? mergeRepository(state.repositories, event.repository)
    : state.repositories;

  return {
    stages,
    percent: Math.max(state.percent, computePercent(stages)),
    log: [...state.log, { id: state.log.length, message: event.message }].slice(
      -maxLogLines,
    ),
    counters: { ...state.counters, ...event.counters },
    repositories,
    currentRepository:
      event.repository?.state === 'analyzing'
        ? event.repository.name
        : event.repository && state.currentRepository === event.repository.name
          ? null
          : state.currentRepository,
    started: true,
  };
}

function mergeRepository(
  rows: PortfolioRepositoryRow[],
  update: NonNullable<PortfolioProgressEvent['repository']>,
): PortfolioRepositoryRow[] {
  const existing = rows.findIndex((row) => row.name === update.name);

  // A repository first appears as "analyzing" and is then replaced by its outcome, so the
  // list never shows the same repository twice.
  if (existing === -1) {
    return [...rows, { ...update }];
  }

  const next = [...rows];
  next[existing] = { ...next[existing], ...update };
  return next;
}

function computePercent(stages: PortfolioStageState[]): number {
  const fraction = stages.reduce((total, entry) => {
    const weight = stageWeights[entry.stage];

    if (entry.status === 'complete') {
      return total + weight;
    }

    if (entry.status === 'active') {
      return total + weight * entry.progress;
    }

    return total;
  }, 0);

  return Math.round(Math.min(1, fraction) * 100);
}
