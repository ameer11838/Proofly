import { useEffect, useRef } from 'react';
import { analysisStageLabels, type AnalysisStage } from '@proofly/shared-types';
import type {
  AnalysisProgressState,
  StageState,
} from '../lib/analysisProgress.js';

interface AnalysisProgressProps {
  state: AnalysisProgressState;
  repositoryFullName: string;
  careerLabel: string;
  /** Set once the report has arrived, for the closing beat before the results appear. */
  completion?: {
    filesAnalyzed: number;
    evidenceSignals: number;
    careerSkills: number;
    score: number;
  };
}

const stageDescriptions: Record<AnalysisStage, string> = {
  'fetching-repository': 'Reading repository structure',
  'inspecting-code': 'Analyzing source files and dependencies',
  'extracting-evidence':
    'Finding code fragments that demonstrate technical skills',
  'career-matching': 'Comparing evidence against the selected career',
  scoring: 'Calculating engineering evidence and career relevance',
  'building-report': 'Preparing your Proofly assessment',
};

export function AnalysisProgress({
  state,
  repositoryFullName,
  careerLabel,
  completion,
}: AnalysisProgressProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const tail = state.log.slice(-14);

  useEffect(() => {
    const node = logRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [state.log.length]);

  const percent = completion ? 100 : state.percent;

  return (
    <section
      // Announced politely so the stage changes reach screen readers without flooding them.
      aria-live="polite"
      aria-busy={completion === undefined}
      className="mt-5 overflow-hidden rounded-3xl border border-slate-300 bg-white font-mono dark:border-slate-700 dark:bg-slate-950"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          {completion ? (
            <span
              className="text-sm font-bold text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            >
              ✓
            </span>
          ) : (
            <span
              className="size-2 rounded-full bg-aurora motion-safe:animate-pulseDot dark:bg-indigo-400"
              aria-hidden="true"
            />
          )}
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-900 dark:text-slate-100">
            {completion ? 'Analysis complete' : 'Analyzing repository'}
          </h3>
        </div>
        <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
          ANALYSIS /{' '}
          <span className="font-bold text-aurora dark:text-indigo-300">
            {percent}%
          </span>
        </p>
      </header>

      <div className="border-b border-slate-200 px-5 py-2.5 dark:border-slate-800">
        <p className="truncate text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {repositoryFullName}{' '}
          <span className="text-slate-300 dark:text-slate-600">·</span>{' '}
          {careerLabel}
        </p>
      </div>

      {/* Progress bar: width is driven only by reported stage completion. */}
      <div className="relative h-1.5 overflow-hidden bg-slate-200 dark:bg-slate-800">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Analysis progress"
          className="h-full bg-gradient-to-r from-blue-600 to-violet-600 transition-[width] duration-500 ease-out dark:from-blue-400 dark:to-violet-400"
          style={{ width: `${Math.max(percent, 1)}%` }}
        />
        {completion ? null : (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/70 to-transparent motion-safe:animate-scan dark:via-white/25"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="grid gap-px bg-slate-200 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] dark:bg-slate-800">
        <ol className="grid gap-2.5 bg-white p-5 dark:bg-slate-950">
          {state.stages.map((stage, index) => (
            <StageRow key={stage.stage} stage={stage} index={index} />
          ))}
        </ol>

        <div className="bg-white p-5 dark:bg-slate-950">
          <div
            ref={logRef}
            className="h-44 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 dark:border-slate-800 dark:bg-slate-900"
          >
            {tail.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500">
                $ awaiting first response…
              </p>
            ) : (
              tail.map((line) => (
                <p
                  key={line.id}
                  className="flex gap-2 text-slate-600 motion-safe:animate-riseIn dark:text-slate-300"
                >
                  <span
                    className="shrink-0 text-aurora dark:text-indigo-400"
                    aria-hidden="true"
                  >
                    ›
                  </span>
                  <span className="min-w-0 break-all">{line.message}</span>
                </p>
              ))
            )}
            {completion ? null : (
              <p
                className="mt-0.5 text-aurora motion-safe:animate-caret dark:text-indigo-400"
                aria-hidden="true"
              >
                ▍
              </p>
            )}
          </div>

          {state.evidence.length > 0 ? (
            <div className="mt-3 rounded-xl border border-aurora/30 bg-aurora/[0.06] p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-aurora dark:text-indigo-300">
                Evidence found
              </p>
              <ul className="mt-1.5 grid gap-1.5">
                {state.evidence.map((item) => (
                  <li key={`${item.path}-${item.startLine}-${item.detected}`}>
                    <p className="truncate text-xs text-slate-800 dark:text-slate-100">
                      {item.detected}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {item.path} : {item.startLine}–{item.endLine}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-200 px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
        {completion ? (
          <>
            <Counter value={completion.filesAnalyzed} label="files analyzed" />
            <Counter
              value={completion.evidenceSignals}
              label="evidence signals"
            />
            <Counter
              value={completion.careerSkills}
              label="career-relevant skills"
            />
            <Counter
              value={completion.score.toFixed(1)}
              label="proofly score"
            />
          </>
        ) : (
          <>
            <Counter
              value={state.counters.filesInspected ?? 0}
              label="files inspected"
            />
            <Counter
              value={state.counters.evidenceSignals ?? 0}
              label="evidence signals"
            />
            <Counter
              value={state.counters.dependencies ?? 0}
              label="dependencies"
            />
          </>
        )}
      </footer>
    </section>
  );
}

function StageRow({ stage, index }: { stage: StageState; index: number }) {
  const number = String(index + 1).padStart(2, '0');
  const isActive = stage.status === 'active';
  const isComplete = stage.status === 'complete';

  return (
    <li>
      <div className="flex items-baseline gap-2">
        <span
          className={`text-[11px] tabular-nums ${
            isComplete || isActive
              ? 'text-aurora dark:text-indigo-300'
              : 'text-slate-300 dark:text-slate-600'
          }`}
        >
          {number} /
        </span>
        <span
          className={`text-[11px] font-bold uppercase tracking-[0.12em] ${
            isActive
              ? 'text-slate-900 dark:text-slate-100'
              : isComplete
                ? 'text-slate-600 dark:text-slate-300'
                : 'text-slate-400 dark:text-slate-600'
          }`}
        >
          {analysisStageLabels[stage.stage]}
        </span>
        {isComplete ? (
          <span
            className="text-xs text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          >
            ✓
          </span>
        ) : null}
        {isActive ? <span className="sr-only">in progress</span> : null}
      </div>
      {isActive ? (
        <p className="mt-0.5 pl-8 text-[11px] text-slate-500 dark:text-slate-400">
          {stageDescriptions[stage.stage]}…
        </p>
      ) : null}
    </li>
  );
}

function Counter({ value, label }: { value: number | string; label: string }) {
  return (
    <span>
      <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </span>{' '}
      {label}
    </span>
  );
}
