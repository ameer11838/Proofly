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
      <p className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">
        Every scored check already passes.
      </p>
    );
  }

  const highestImpact = plan.actions.filter((action) => !action.quickWin);
  const quickWins = plan.actions.filter((action) => action.quickWin);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xl font-semibold tabular-nums text-[var(--text)]">
          {plan.currentScore.toFixed(1)}
          <span
            className="mx-2 text-[var(--border-strong)]"
            aria-label="improves to"
          >
            →
          </span>
          <span className="text-[var(--success)]">
            {plan.potentialScore.toFixed(1)}
          </span>
          <span className="ml-1 text-sm font-normal text-[var(--muted)]">
            / {plan.maxScore.toFixed(0)}
          </span>
        </p>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Actions tied to the score show the points they recover. The rest are
          ordered by how much they would improve the code.
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
      <h4 className="field-label mb-2 font-medium text-[var(--text)]">
        {title}
      </h4>
      <ol className="grid gap-3">
        {actions.map((action, index) => (
          <li
            key={action.id}
            className={`grid gap-2 rounded-[var(--radius-sm)] border border-l-2 border-[var(--border)] px-3 py-3 sm:grid-cols-[1.5rem_minmax(0,1fr)_auto] sm:items-start sm:gap-3 ${impactSurface(action.impact)}`}
          >
            <span className="text-xs tabular-nums text-[var(--muted)]">
              {index + 1}.
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">
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
              <p className="field-label mt-1">
                {scoreCategoryLabels[action.category]}
              </p>
              {action.suggestedApproach ? (
                <details className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                  <summary className="focus-control cursor-pointer text-sm font-medium text-[var(--accent)]">
                    How to fix it
                  </summary>
                  <div className="mt-2 grid gap-2 text-sm leading-6 text-[var(--muted)]">
                    <p>{action.suggestedApproach}</p>
                    {action.example ? (
                      <pre className="overflow-x-auto rounded-[var(--radius-sm)] border border-[#30363d] bg-[#0d1117] p-3 font-mono text-xs leading-5 text-[#e6edf3]">
                        <code>{action.example}</code>
                      </pre>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>
            <span
              className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${impactClass(action.impact)}`}
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
    return 'border-[var(--warning)] bg-[var(--surface)]';
  }
  if (impact === 'Low') {
    return 'border-[var(--border)] bg-[var(--surface)]';
  }
  return 'border-[var(--border-strong)] bg-[var(--surface)]';
}
