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
  scoring: 'Calculating project strength and career relevance',
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
      className="surface mt-5 overflow-hidden font-mono"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          {completion ? (
            <span
              className="text-sm font-bold text-[var(--success)]"
              aria-hidden="true"
            >
              ✓
            </span>
          ) : (
            <span
              className="size-2 rounded-full bg-[var(--accent)] motion-safe:animate-pulseDot"
              aria-hidden="true"
            />
          )}
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--text)]">
            {completion ? 'Analysis complete' : 'Analyzing repository'}
          </h3>
        </div>
        <p className="text-xs tabular-nums text-[var(--muted)]">
          ANALYSIS /{' '}
          <span className="font-bold text-[var(--accent)]">{percent}%</span>
        </p>
      </header>

      <div className="border-b border-[var(--border)] px-5 py-2.5">
        <p className="truncate text-xs uppercase tracking-wider text-[var(--muted)]">
          {repositoryFullName}{' '}
          <span className="text-[var(--border-strong)]">·</span> {careerLabel}
        </p>
      </div>

      {/* Progress bar: width is driven only by reported stage completion. */}
      <div className="h-1.5 overflow-hidden bg-[var(--surface-subtle)]">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Analysis progress"
          className="h-full bg-[var(--accent)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${Math.max(percent, 1)}%` }}
        />
      </div>

      <div className="grid gap-px bg-[var(--border)] md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ol className="grid gap-2.5 bg-[var(--surface)] p-5">
          {state.stages.map((stage, index) => (
            <StageRow key={stage.stage} stage={stage} index={index} />
          ))}
        </ol>

        <div className="bg-[var(--surface)] p-5">
          <div
            ref={logRef}
            className="h-44 overflow-y-auto rounded-[7px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-xs leading-6"
          >
            {tail.length === 0 ? (
              <p className="text-[var(--muted)]">$ awaiting first response…</p>
            ) : (
              tail.map((line) => (
                <p
                  key={line.id}
                  className="flex gap-2 text-[var(--text)] motion-safe:animate-riseIn"
                >
                  <span
                    className="shrink-0 text-[var(--accent)]"
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
                className="mt-0.5 text-[var(--accent)] motion-safe:animate-caret"
                aria-hidden="true"
              >
                ▍
              </p>
            )}
          </div>

          {state.evidence.length > 0 ? (
            <div className="mt-3 border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                Evidence found
              </p>
              <ul className="mt-1.5 grid gap-1.5">
                {state.evidence.map((item) => (
                  <li key={`${item.path}-${item.startLine}-${item.detected}`}>
                    <p className="truncate text-sm text-[var(--text)]">
                      {item.detected}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {item.path} : {item.startLine}–{item.endLine}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--border)] px-5 py-3 text-xs uppercase tracking-wider text-[var(--muted)]">
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
          className={`text-xs tabular-nums ${
            isComplete || isActive
              ? 'text-[var(--accent)]'
              : 'text-[var(--border-strong)]'
          }`}
        >
          {number} /
        </span>
        <span
          className={`text-xs font-bold uppercase tracking-[0.1em] ${
            isActive
              ? 'text-[var(--text)]'
              : isComplete
                ? 'text-[var(--muted)]'
                : 'text-[var(--border-strong)]'
          }`}
        >
          {analysisStageLabels[stage.stage]}
        </span>
        {isComplete ? (
          <span className="text-xs text-[var(--success)]" aria-hidden="true">
            ✓
          </span>
        ) : null}
        {isActive ? <span className="sr-only">in progress</span> : null}
      </div>
      {isActive ? (
        <p className="mt-0.5 pl-8 text-xs text-[var(--muted)]">
          {stageDescriptions[stage.stage]}…
        </p>
      ) : null}
    </li>
  );
}

function Counter({ value, label }: { value: number | string; label: string }) {
  return (
    <span>
      <span className="font-bold tabular-nums text-[var(--text)]">{value}</span>{' '}
      {label}
    </span>
  );
}
