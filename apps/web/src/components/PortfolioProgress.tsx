import { useEffect, useRef } from 'react';
import { portfolioStageLabels } from '@proofly/shared-types';
import type {
  PortfolioProgressState,
  PortfolioRepositoryRow,
} from '../lib/portfolioProgress.js';

interface PortfolioProgressProps {
  state: PortfolioProgressState;
  username: string;
  careerLabel: string;
  /** Set once the portfolio score has arrived, for the closing beat. */
  completion?: {
    discovered: number;
    deeplyAnalyzed: number;
    skipped: number;
    score: number;
  };
}

export function PortfolioProgress({
  state,
  username,
  careerLabel,
  completion,
}: PortfolioProgressProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const resolved = state.repositories.filter(
    (row) => row.state !== 'analyzing',
  );
  const queued = state.counters.queued ?? 0;
  const percent = completion ? 100 : state.percent;
  const activeStage = state.stages.find((stage) => stage.status === 'active');

  useEffect(() => {
    const node = listRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [state.repositories.length]);

  return (
    <section
      aria-live="polite"
      aria-busy={completion === undefined}
      className="surface mb-6 overflow-hidden font-mono"
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
            {completion
              ? 'Portfolio assessment complete'
              : queued > 0
                ? `Analyzing portfolio — ${resolved.length} / ${queued} repositories`
                : 'Analyzing portfolio'}
          </h3>
        </div>
        <p className="text-xs tabular-nums text-[var(--muted)]">
          PORTFOLIO /{' '}
          <span className="font-bold text-[var(--accent)]">{percent}%</span>
        </p>
      </header>

      <div className="border-b border-[var(--border)] px-5 py-2.5">
        <p className="truncate text-xs uppercase tracking-wider text-[var(--muted)]">
          @{username} <span className="text-[var(--border-strong)]">·</span>{' '}
          {careerLabel}
          {activeStage && !completion ? (
            <>
              {' '}
              <span className="text-[var(--border-strong)]">·</span>{' '}
              {portfolioStageLabels[activeStage.stage]}
            </>
          ) : null}
        </p>
      </div>

      <div className="h-1.5 overflow-hidden bg-[var(--surface-subtle)]">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Portfolio analysis progress"
          className="h-full bg-[var(--accent)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${Math.max(percent, 1)}%` }}
        />
      </div>

      <div className="p-5">
        <div
          ref={listRef}
          className="max-h-56 overflow-y-auto rounded-[7px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3"
        >
          {state.repositories.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">
              $ discovering repositories…
            </p>
          ) : (
            <ul className="grid gap-1">
              {state.repositories.map((row) => (
                <RepositoryRow key={row.name} row={row} />
              ))}
            </ul>
          )}
        </div>

        {state.currentRepository && !completion ? (
          <p className="mt-3 text-xs uppercase tracking-wider text-[var(--muted)]">
            Current repository:{' '}
            <span className="font-bold text-[var(--text)]">
              {state.currentRepository}
            </span>
            <span
              className="motion-safe:animate-caret text-[var(--accent)]"
              aria-hidden="true"
            >
              {' '}
              ▍
            </span>
          </p>
        ) : null}
      </div>

      <footer className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--border)] px-5 py-3 text-xs uppercase tracking-wider text-[var(--muted)]">
        {completion ? (
          <>
            <Counter
              value={completion.discovered}
              label="repositories discovered"
            />
            <Counter
              value={completion.deeplyAnalyzed}
              label="deeply analyzed"
            />
            <Counter value={completion.skipped} label="skipped" />
            <Counter value={completion.score.toFixed(1)} label="career score" />
          </>
        ) : (
          <>
            <Counter
              value={state.counters.discovered ?? 0}
              label="discovered"
            />
            <Counter
              value={state.counters.deeplyAnalyzed ?? 0}
              label="analyzed"
            />
            <Counter value={state.counters.skipped ?? 0} label="skipped" />
          </>
        )}
      </footer>
    </section>
  );
}

function RepositoryRow({ row }: { row: PortfolioRepositoryRow }) {
  const marker =
    row.state === 'analyzed' ? '✓' : row.state === 'skipped' ? '–' : '›';
  const markerClass =
    row.state === 'analyzed'
      ? 'text-[var(--success)]'
      : row.state === 'skipped'
        ? 'text-[var(--border-strong)]'
        : 'text-[var(--accent)]';

  return (
    <li className="flex items-baseline gap-2 text-xs motion-safe:animate-riseIn">
      <span className={`shrink-0 ${markerClass}`} aria-hidden="true">
        {marker}
      </span>
      <span
        className={`min-w-0 truncate ${
          row.state === 'skipped'
            ? 'text-[var(--border-strong)] line-through'
            : 'text-[var(--text)]'
        }`}
      >
        {row.name}
      </span>
      {row.state === 'analyzed' && row.strength !== undefined ? (
        <span className="shrink-0 tabular-nums text-[var(--muted)]">
          {row.strength.toFixed(1)}/10
        </span>
      ) : null}
      {row.state === 'skipped' && row.reason ? (
        <span className="min-w-0 truncate text-[var(--muted)]">
          {row.reason}
        </span>
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
