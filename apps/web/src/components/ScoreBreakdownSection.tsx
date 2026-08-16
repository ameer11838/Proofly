import type { ScoreBreakdown, ScoreCategory } from '@proofly/shared-types';
import { Collapsible } from './Collapsible.js';

interface ScoreBreakdownSectionProps {
  breakdown: ScoreBreakdown;
}

export function ScoreBreakdownSection({
  breakdown,
}: ScoreBreakdownSectionProps) {
  return (
    <div className="grid gap-2">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Each category contributes points directly to the Proofly score. The six
        categories add up to{' '}
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {breakdown.score.toFixed(1)} / {breakdown.maxScore.toFixed(0)}
        </span>
        .
      </p>

      <div className="grid gap-1">
        {breakdown.categories.map((category) => (
          <CategoryRow key={category.key} category={category} />
        ))}
      </div>

      <div className="flex items-center justify-between border-t-2 border-slate-900/10 pt-3 dark:border-slate-100/15 text-sm font-bold text-slate-900 dark:text-slate-100">
        <span>Total</span>
        <span>
          {breakdown.score.toFixed(1)} / {breakdown.maxScore.toFixed(0)}
        </span>
      </div>
    </div>
  );
}

function CategoryRow({ category }: { category: ScoreCategory }) {
  const percentage =
    category.max > 0 ? (category.earned / category.max) * 100 : 0;

  return (
    <Collapsible
      title={category.label}
      summary={category.description}
      badge={
        <span className="flex items-center gap-3">
          <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 sm:block">
            <span
              className={`block h-full rounded-full ${barColor(percentage)}`}
              style={{ width: `${Math.max(percentage, 2)}%` }}
            />
          </span>
          <span className="w-16 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {category.earned.toFixed(1)}/{category.max.toFixed(1)}
          </span>
        </span>
      }
    >
      <ul className="grid gap-2">
        {category.signals.map((signal) => (
          <li
            key={signal.label}
            className="grid gap-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4"
          >
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {signal.label}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {signal.detail}
              </p>
              {signal.evidence.length > 0 ? (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {signal.evidence.map((reference, index) => (
                    <li
                      key={`${reference.label}-${reference.path ?? index}`}
                      className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                    >
                      {reference.path ?? reference.label}
                      {reference.line ? `:${reference.line}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <span
              className={`text-sm font-semibold tabular-nums ${
                signal.earned >= signal.max
                  ? 'text-emerald-600'
                  : 'text-slate-400'
              }`}
            >
              {signal.earned.toFixed(1)}/{signal.max.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
    </Collapsible>
  );
}

function barColor(percentage: number): string {
  if (percentage >= 75) {
    return 'bg-emerald-500 dark:bg-emerald-400';
  }

  if (percentage >= 40) {
    return 'bg-amber-500 dark:bg-amber-400';
  }

  return 'bg-rose-400 dark:bg-rose-300';
}
