import {
  analysisStageWeights,
  analysisStages,
  type AnalysisEvidenceFlash,
  type AnalysisProgressCounters,
  type AnalysisProgressEvent,
  type AnalysisStage,
} from '@proofly/shared-types';

export type StageStatus = 'pending' | 'active' | 'complete';

export interface StageState {
  stage: AnalysisStage;
  status: StageStatus;
  /** 0-1 within the stage, only ever set from a reported value. */
  progress: number;
}

export interface LogLine {
  id: number;
  message: string;
  file?: string;
  stage: AnalysisStage;
}

export interface AnalysisProgressState {
  stages: StageState[];
  activeStage: AnalysisStage | null;
  /** 0-100, derived from completed stage weights plus reported sub-progress. */
  percent: number;
  log: LogLine[];
  counters: AnalysisProgressCounters;
  evidence: AnalysisEvidenceFlash[];
  started: boolean;
}

/** Log lines kept in memory; the panel only shows the tail. */
const maxLogLines = 40;
const maxEvidenceFlashes = 3;

export const initialAnalysisProgress: AnalysisProgressState = {
  stages: analysisStages.map((stage) => ({
    stage,
    status: 'pending',
    progress: 0,
  })),
  activeStage: null,
  percent: 0,
  log: [],
  counters: {},
  evidence: [],
  started: false,
};

export type AnalysisProgressAction =
  { type: 'reset' } | { type: 'progress'; event: AnalysisProgressEvent };

export function analysisProgressReducer(
  state: AnalysisProgressState,
  action: AnalysisProgressAction,
): AnalysisProgressState {
  return action.type === 'reset'
    ? initialAnalysisProgress
    : applyProgressEvent(state, action.event);
}

/** Pure state transition for one reported event. */
export function applyProgressEvent(
  state: AnalysisProgressState,
  event: AnalysisProgressEvent,
): AnalysisProgressState {
  const eventIndex = analysisStages.indexOf(event.stage);

  const stages = state.stages.map((entry, index): StageState => {
    // The server runs stages in order, so reaching one means the earlier ones finished.
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

  const log: LogLine[] = [
    ...state.log,
    {
      id: state.log.length,
      message: event.message,
      file: event.file,
      stage: event.stage,
    },
  ].slice(-maxLogLines);

  return {
    stages,
    activeStage:
      event.status === 'complete' && eventIndex === analysisStages.length - 1
        ? null
        : event.stage,
    // Monotonic: a later event can never walk the bar backwards.
    percent: Math.max(state.percent, computePercent(stages)),
    log,
    counters: { ...state.counters, ...event.counters },
    evidence: event.evidence
      ? [event.evidence, ...state.evidence].slice(0, maxEvidenceFlashes)
      : state.evidence,
    started: true,
  };
}

function computePercent(stages: StageState[]): number {
  const fraction = stages.reduce((total, entry) => {
    const weight = analysisStageWeights[entry.stage];

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
