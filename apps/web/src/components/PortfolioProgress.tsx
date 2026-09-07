import { useEffect, useRef } from 'react';
import { portfolioStageLabels } from '@proofly/shared-types';
import type {
  PortfolioProgressState,
  PortfolioRepositoryRow,
} from '../lib/portfolioProgress.js';
import { StatusDot } from './AnalysisProgress.js';

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
      className="surface mb-6 overflow-hidden"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <StatusDot done={completion !== undefined} />
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {completion
              ? 'Portfolio scored'
              : queued > 0
                ? `Analyzing ${resolved.length} of ${queued} repositories`
                : 'Analyzing portfolio'}
          </h3>
          <span className="truncate text-xs text-[var(--muted)]">
            @{username} · {careerLabel}
            {activeStage && !completion
              ? ` · ${portfolioStageLabels[activeStage.stage]}`
              : ''}
          </span>
        </div>
        <span className="text-xs tabular-nums text-[var(--muted)]">
          {percent}%
        </span>
      </header>

      <div className="h-0.5 bg-[var(--surface-raised)]">
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

      <div
        ref={listRef}
        className="max-h-52 overflow-y-auto px-4 py-3 text-xs"
      >
        {state.repositories.length === 0 ? (
          <p className="text-[var(--muted)]">Finding repositories…</p>
        ) : (
          <ul className="grid gap-1.5">
            {state.repositories.map((row) => (
              <RepositoryRow key={row.name} row={row} />
            ))}
          </ul>
        )}
      </div>

      <footer className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--border)] px-4 py-2.5 text-xs text-[var(--muted)]">
        {completion ? (
          <>
            <Counter value={completion.discovered} label="discovered" />
            <Counter value={completion.deeplyAnalyzed} label="analyzed" />
            <Counter value={completion.skipped} label="skipped" />
            <Counter
              value={completion.score.toFixed(1)}
              label="career score"
            />
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
  const skipped = row.state === 'skipped';

  return (
    <li className="flex items-baseline gap-2 motion-safe:animate-riseIn">
      <span
        aria-hidden="true"
        className={`mt-1 size-1.5 shrink-0 self-start rounded-full ${
          row.state === 'analyzed'
            ? 'bg-[var(--success)]'
            : skipped
              ? 'bg-[var(--border)]'
              : 'bg-[var(--accent)] motion-safe:animate-pulseDot'
        }`}
      />
      <span
        className={`min-w-0 truncate font-mono ${
          skipped ? 'text-[var(--muted)]' : 'text-[var(--text)]'
        }`}
      >
        {row.name}
      </span>
      {row.state === 'analyzed' && row.strength !== undefined ? (
        <span className="shrink-0 tabular-nums text-[var(--muted)]">
          {row.strength.toFixed(1)}/10
        </span>
      ) : null}
      {skipped && row.reason ? (
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
      <span className="font-medium tabular-nums text-[var(--text)]">
        {value}
      </span>{' '}
      {label}
    </span>
  );
}
