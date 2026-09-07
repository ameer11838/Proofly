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
      <p className="card-flat bg-[var(--success-soft)] px-3 py-2 text-sm font-semibold text-[var(--success)]">
        Every scored check already passes.
      </p>
    );
  }

  const highestImpact = plan.actions.filter((action) => !action.quickWin);
  const quickWins = plan.actions.filter((action) => action.quickWin);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="display text-3xl tabular-nums text-[var(--ink)]">
          {plan.currentScore.toFixed(1)}
          <span
            className="mx-2 text-[var(--line)]"
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
      <h4 className="label-mono mb-2 text-[var(--ink)]">{title}</h4>
      <ol className="grid gap-3">
        {actions.map((action, index) => (
          <li
            key={action.id}
            className={`grid gap-2 rounded-[var(--radius)] border-2 border-l-[6px] border-[var(--line)] px-3.5 py-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_auto] sm:items-start sm:gap-3 ${impactSurface(action.impact)}`}
          >
            <span className="display text-lg tabular-nums text-[var(--muted)]">
              {index + 1}
            </span>
            <div>
              <p className="display text-base text-[var(--ink)]">
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
              <p className="label-mono mt-1">
                {scoreCategoryLabels[action.category]}
              </p>
              {action.suggestedApproach ? (
                <details className="card-flat mt-3 bg-[var(--surface)] px-3 py-2.5">
                  <summary className="focus-control cursor-pointer text-sm font-medium text-[var(--brand)]">
                    How to fix it
                  </summary>
                  <div className="mt-2 grid gap-2 text-sm leading-6 text-[var(--muted)]">
                    <p>{action.suggestedApproach}</p>
                    {action.example ? (
                      <pre className="overflow-x-auto rounded-[var(--radius)] border-2 border-[var(--line)] bg-[#12101a] p-3 font-mono text-xs leading-5 text-[#e9e3f5]">
                        <code>{action.example}</code>
                      </pre>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>
            <span
              className={`pill ${impactClass(action.impact)}`}
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
    return 'bg-[var(--danger-soft)] text-[var(--danger)]';
  }
  if (impact === 'Low') {
    return 'bg-[var(--surface-2)] text-[var(--muted)]';
  }
  return 'bg-[var(--warning-soft)] text-[var(--warning)]';
}

function impactSurface(impact: ImprovementPlan['actions'][number]['impact']) {
  if (impact === 'High') {
    return 'border-[var(--warning)] bg-[var(--surface)]';
  }
  if (impact === 'Low') {
    return 'border-[var(--hair)] bg-[var(--surface)]';
  }
  return 'border-[var(--line)] bg-[var(--surface)]';
}
