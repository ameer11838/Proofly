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
      <p className="text-sm text-[var(--muted)]">
        Each category contributes points directly to the Proofly score. The five
        categories add up to{' '}
        <span className="font-semibold text-[var(--text)]">
          {breakdown.score.toFixed(1)} / {breakdown.maxScore.toFixed(0)}
        </span>
        .
      </p>

      <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {breakdown.categories.map((category) => (
          <CategoryRow key={category.key} category={category} />
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 text-sm font-bold text-[var(--text)]">
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
          <span className="hidden h-1 w-24 overflow-hidden bg-[var(--border)] sm:block">
            <span
              className={`block h-full rounded-full ${barColor(percentage)}`}
              style={{ width: `${Math.max(percentage, 2)}%` }}
            />
          </span>
          <span className="w-16 text-right font-mono text-xs font-semibold tabular-nums text-[var(--text)]">
            {category.earned.toFixed(1)}/{category.max.toFixed(1)}
          </span>
        </span>
      }
    >
      <ul className="divide-y divide-[var(--border)]">
        {category.signals.map((signal) => (
          <li
            key={signal.label}
            className="grid gap-1 px-1 py-3 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-4"
          >
            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                {signal.label}
              </p>
              <p className="text-sm text-[var(--muted)]">{signal.detail}</p>
              {signal.evidence.length > 0 ? (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {signal.evidence.map((reference, index) => (
                    <li
                      key={`${reference.label}-${reference.path ?? index}`}
                      className="font-mono text-xs text-[var(--muted)]"
                    >
                      {reference.path ?? reference.label}
                      {reference.line ? `:${reference.line}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <span
              className={`font-mono text-xs font-semibold tabular-nums ${
                signal.earned >= signal.max
                  ? 'text-[var(--success)]'
                  : 'text-[var(--muted)]'
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
    return 'bg-[var(--success)]';
  }

  if (percentage >= 40) {
    return 'bg-[var(--warning)]';
  }

  return 'bg-[var(--error)]';
}
