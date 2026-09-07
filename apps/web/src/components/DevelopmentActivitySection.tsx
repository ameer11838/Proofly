import type { DevelopmentActivityReport } from '@proofly/shared-types';

export function DevelopmentActivitySection({
  activity,
}: {
  activity: DevelopmentActivityReport;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <strong className="display text-3xl tabular-nums text-[var(--ink)]">
          {activity.commitCount} commits
        </strong>
        <span aria-hidden="true" className="text-[var(--line)]">
          ·
        </span>
        <span className="text-sm text-[var(--muted)]">{activity.label}</span>
      </div>
      <p className="text-sm leading-6 text-[var(--muted)]">
        {activity.summary}
      </p>

      {activity.commits.length > 0 ? (
        <ul className="divide-y-2 divide-dashed divide-[var(--hair)] border-y-2 border-[var(--hair)]">
          {activity.commits.slice(0, 10).map((commit) => (
            <li
              key={commit.sha}
              className="grid gap-2 py-3 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-start"
            >
              <a
                href={commit.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs font-semibold text-[var(--brand)] hover:underline"
              >
                {commit.sha.slice(0, 7)}
              </a>
              <div>
                <p className="font-mono text-xs text-[var(--ink)]">
                  {commit.message}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {commit.reason}
                </p>
                {commit.quality === 'weak' ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Name the change instead, e.g. “Add contribution detection
                    for forked repositories”.
                  </p>
                ) : null}
              </div>
              <span
                className={`pill ${
                  commit.quality === 'clear'
                    ? 'bg-[var(--success-soft)] text-[var(--success)]'
                    : 'bg-[var(--warning-soft)] text-[var(--warning)]'
                }`}
              >
                {commit.quality}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs leading-5 text-[var(--muted)]">
        Scored on whether the messages describe real milestones. Commit count on
        its own earns nothing.
      </p>
    </div>
  );
}
