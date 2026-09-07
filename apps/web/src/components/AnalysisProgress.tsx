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
  'fetching-repository': 'Reading the repository structure',
  'inspecting-code': 'Reading source files and dependencies',
  'extracting-evidence': 'Pulling code that shows technical skills',
  'career-matching': 'Matching that code against the career track',
  scoring: 'Scoring project strength and career relevance',
  'building-report': 'Assembling the report',
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
      className="surface mt-4 overflow-hidden"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <StatusDot done={completion !== undefined} />
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {completion ? 'Analysis complete' : 'Analyzing repository'}
          </h3>
          <span className="truncate font-mono text-xs text-[var(--muted)]">
            {repositoryFullName} · {careerLabel}
          </span>
        </div>
        <span className="text-xs tabular-nums text-[var(--muted)]">
          {percent}%
        </span>
      </header>

      {/* Progress bar: width is driven only by reported stage completion. */}
      <div className="h-0.5 bg-[var(--surface-raised)]">
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

      <div className="grid gap-px bg-[var(--border)] md:grid-cols-2">
        <ol className="grid content-start gap-2 bg-[var(--surface)] p-4">
          {state.stages.map((stage) => (
            <StageRow key={stage.stage} stage={stage} />
          ))}
        </ol>

        <div className="bg-[var(--surface)] p-4">
          <div
            ref={logRef}
            className="h-40 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-subtle)] p-3 font-mono text-xs leading-6"
          >
            {tail.length === 0 ? (
              <p className="text-[var(--muted)]">Waiting for the first result…</p>
            ) : (
              tail.map((line) => (
                <p
                  key={line.id}
                  className="break-all text-[var(--muted)] last:text-[var(--text)] motion-safe:animate-riseIn"
                >
                  {line.message}
                </p>
              ))
            )}
          </div>

          {state.evidence.length > 0 ? (
            <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
              <p className="field-label font-medium text-[var(--text)]">
                Evidence found
              </p>
              <ul className="mt-2 grid gap-2">
                {state.evidence.map((item) => (
                  <li key={`${item.path}-${item.startLine}-${item.detected}`}>
                    <p className="truncate text-xs text-[var(--text)]">
                      {item.detected}
                    </p>
                    <p className="truncate font-mono text-xs text-[var(--muted)]">
                      {item.path}:{item.startLine}–{item.endLine}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--border)] px-4 py-2.5 text-xs text-[var(--muted)]">
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
            <Counter value={completion.score.toFixed(1)} label="score" />
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

export function StatusDot({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`size-2 shrink-0 rounded-full ${
        done
          ? 'bg-[var(--success)]'
          : 'bg-[var(--accent)] motion-safe:animate-pulseDot'
      }`}
    />
  );
}

function StageRow({ stage }: { stage: StageState }) {
  const isActive = stage.status === 'active';
  const isComplete = stage.status === 'complete';

  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden="true"
        className={`mt-[0.45rem] size-1.5 shrink-0 rounded-full ${
          isComplete
            ? 'bg-[var(--success)]'
            : isActive
              ? 'bg-[var(--accent)]'
              : 'bg-[var(--border)]'
        }`}
      />
      <div className="min-w-0">
        <p
          className={`text-sm ${
            isActive
              ? 'font-medium text-[var(--text)]'
              : isComplete
                ? 'text-[var(--muted)]'
                : 'text-[var(--border-strong)]'
          }`}
        >
          {analysisStageLabels[stage.stage]}
        </p>
        {isActive ? (
          <>
            <p className="text-xs text-[var(--muted)]">
              {stageDescriptions[stage.stage]}…
            </p>
            <span className="sr-only">in progress</span>
          </>
        ) : null}
      </div>
    </li>
  );
}

function Counter({ value, label }: { value: number | string; label: string }) {
  return (
    <span>
      <span className="font-medium tabular-nums text-[var(--text)]">
        {value}
      </span>{' '}
      {label}
    </span>
  );
}
