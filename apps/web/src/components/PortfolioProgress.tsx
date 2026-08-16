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
      className="mb-6 overflow-hidden rounded-3xl border border-slate-300 bg-white font-mono dark:border-slate-700 dark:bg-slate-950"
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
            {completion
              ? 'Portfolio assessment complete'
              : queued > 0
                ? `Analyzing portfolio — ${resolved.length} / ${queued} repositories`
                : 'Analyzing portfolio'}
          </h3>
        </div>
        <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
          PORTFOLIO /{' '}
          <span className="font-bold text-aurora dark:text-indigo-300">
            {percent}%
          </span>
        </p>
      </header>

      <div className="border-b border-slate-200 px-5 py-2.5 dark:border-slate-800">
        <p className="truncate text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
          @{username}{' '}
          <span className="text-slate-300 dark:text-slate-600">·</span>{' '}
          {careerLabel}
          {activeStage && !completion ? (
            <>
              {' '}
              <span className="text-slate-300 dark:text-slate-600">·</span>{' '}
              {portfolioStageLabels[activeStage.stage]}
            </>
          ) : null}
        </p>
      </div>

      <div className="relative h-1.5 overflow-hidden bg-slate-200 dark:bg-slate-800">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Portfolio analysis progress"
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

      <div className="p-5">
        <div
          ref={listRef}
          className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
        >
          {state.repositories.length === 0 ? (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
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
          <p className="mt-3 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Current repository:{' '}
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {state.currentRepository}
            </span>
            <span
              className="motion-safe:animate-caret text-aurora dark:text-indigo-400"
              aria-hidden="true"
            >
              {' '}
              ▍
            </span>
          </p>
        ) : null}
      </div>

      <footer className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-200 px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
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
      ? 'text-emerald-600 dark:text-emerald-400'
      : row.state === 'skipped'
        ? 'text-slate-400 dark:text-slate-600'
        : 'text-aurora dark:text-indigo-400';

  return (
    <li className="flex items-baseline gap-2 text-[11px] motion-safe:animate-riseIn">
      <span className={`shrink-0 ${markerClass}`} aria-hidden="true">
        {marker}
      </span>
      <span
        className={`min-w-0 truncate ${
          row.state === 'skipped'
            ? 'text-slate-400 line-through dark:text-slate-600'
            : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {row.name}
      </span>
      {row.state === 'analyzed' && row.strength !== undefined ? (
        <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
          {row.strength.toFixed(1)}/10
        </span>
      ) : null}
      {row.state === 'skipped' && row.reason ? (
        <span className="min-w-0 truncate text-slate-400 dark:text-slate-500">
          {row.reason}
        </span>
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
