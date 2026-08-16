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
      <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
        Every scored check already passes. There is no improvement Proofly can
        derive from its own scoring model.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
          {plan.currentScore.toFixed(1)}
          <span className="mx-2 text-slate-300" aria-label="improves to">
            →
          </span>
          <span className="text-aurora dark:text-indigo-300">
            {plan.potentialScore.toFixed(1)}
          </span>
          <span className="ml-1 text-base font-semibold text-slate-400 dark:text-slate-500">
            / {plan.maxScore.toFixed(0)}
          </span>
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Doing everything below recovers exactly the points those checks are
          currently losing.
        </p>
      </div>

      <ol className="grid gap-2">
        {plan.actions.map((action) => (
          <li
            key={action.id}
            className="flex flex-col gap-1 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
          >
            <span className="order-2 w-fit shrink-0 rounded-full bg-aurora/10 dark:bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-aurora dark:text-indigo-300 tabular-nums sm:order-none">
              +{action.points.toFixed(1)}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {action.title}
              </p>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {action.detail}
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                {scoreCategoryLabels[action.category]}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
