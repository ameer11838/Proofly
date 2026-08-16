import {
  scoreCategoryLabels,
  type ImprovementPlan,
} from '@proofly/shared-types';

interface ImprovementSectionProps {
  plan: ImprovementPlan;
}

export function ImprovementSection({ plan }: ImprovementSectionProps) {
  if (plan.actions.length === 0) {
    return (
      <p className="rounded-[7px] bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success)]">
        Every scored check already passes. There is no improvement Proofly can
        derive from its own scoring model.
      </p>
    );
  }

  const highestImpact = plan.actions.filter((action) => !action.quickWin);
  const quickWins = plan.actions.filter((action) => action.quickWin);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-2xl font-black tracking-tight text-[var(--text)]">
          {plan.currentScore.toFixed(1)}
          <span
            className="mx-2 text-[var(--border-strong)]"
            aria-label="improves to"
          >
            →
          </span>
          <span className="text-[var(--accent)]">
            {plan.potentialScore.toFixed(1)}
          </span>
          <span className="ml-1 text-base font-semibold text-[var(--muted)]">
            / {plan.maxScore.toFixed(0)}
          </span>
        </p>
        <p className="text-sm text-[var(--muted)]">
          Score-linked actions show recoverable points. Source-quality actions
          are prioritized by engineering impact without inventing score credit.
        </p>
      </div>

      <ActionGroup title="Highest impact" actions={highestImpact} />
      {quickWins.length > 0 ? (
        <ActionGroup title="Quick wins" actions={quickWins} />
      ) : null}
    </div>
  );
}

function ActionGroup({
  title,
  actions,
}: {
  title: string;
  actions: ImprovementPlan['actions'];
}) {
  if (actions.length === 0) return null;
  return (
    <section>
      <h4 className="technical-label mb-2 font-bold text-[var(--text)]">
        {title}
      </h4>
      <ol className="grid gap-3">
        {actions.map((action, index) => (
          <li
            key={action.id}
            className={`grid gap-2 rounded-[var(--radius-sm)] border-l-4 px-4 py-4 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-start sm:gap-4 ${impactSurface(action.impact)}`}
          >
            <span className="font-mono text-xs font-bold text-[var(--accent)]">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <p className="text-base font-bold text-[var(--text)]">
                {action.title}
              </p>
              <p className="text-sm leading-6 text-[var(--muted)]">
                {action.detail}
              </p>
              {action.paths && action.paths.length > 0 ? (
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                  {action.paths.join(' · ')}
                </p>
              ) : null}
              <p className="technical-label mt-1">
                {scoreCategoryLabels[action.category]}
              </p>
              {action.suggestedApproach ? (
                <details className="mt-3 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <summary className="focus-control cursor-pointer font-mono text-sm font-bold text-[var(--accent)]">
                    How can I improve this?
                  </summary>
                  <div className="mt-2 grid gap-2 text-sm leading-6 text-[var(--muted)]">
                    <p>{action.suggestedApproach}</p>
                    {action.example ? (
                      <pre className="overflow-x-auto rounded-[6px] bg-[#080c14] p-3 font-mono text-xs leading-5 text-slate-200">
                        <code>{action.example}</code>
                      </pre>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>
            <span
              className={`w-fit rounded-[5px] px-2 py-1 font-mono text-xs font-bold uppercase ${impactClass(action.impact)}`}
            >
              {action.impact ?? 'Medium'}
              {action.points > 0 ? ` · +${action.points.toFixed(1)}` : ''}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function impactClass(impact: ImprovementPlan['actions'][number]['impact']) {
  if (impact === 'High') {
    return 'bg-[var(--error-soft)] text-[var(--error)]';
  }
  if (impact === 'Low') {
    return 'bg-[var(--surface-subtle)] text-[var(--muted)]';
  }
  return 'bg-[var(--warning-soft)] text-[var(--warning)]';
}

function impactSurface(impact: ImprovementPlan['actions'][number]['impact']) {
  if (impact === 'High') {
    return 'border-[var(--warning)] bg-[var(--warning-soft)]';
  }
  if (impact === 'Low') {
    return 'border-[var(--border-strong)] bg-[var(--surface-subtle)]';
  }
  return 'border-[var(--warning)] bg-[var(--warning-soft)]';
}
