import type { CodeQualityReport } from '@proofly/shared-types';
import { Collapsible } from './Collapsible.js';

export function CodeQualitySection({ report }: { report: CodeQualityReport }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-dashed border-[var(--hair)] pb-4">
        <div>
          <p className="label-mono">Code quality</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="display text-5xl tabular-nums text-[var(--ink)]">
              {report.score.toFixed(1)}
            </span>
            <span className="text-sm text-[var(--muted)]">/ 10</span>
          </p>
        </div>
        <p className="max-w-xl text-sm text-[var(--muted)]">
          {report.summary}
        </p>
      </div>

      <div className="grid gap-2">
        {report.dimensions.map((dimension) => (
          <Collapsible
            key={dimension.key}
            title={dimension.label}
            summary={dimension.summary}
            badge={
              <span className="text-xs font-medium tabular-nums text-[var(--muted)]">
                {dimension.score.toFixed(1)}
              </span>
            }
          >
            <div className="grid gap-3">
              <div className="h-2.5 overflow-hidden rounded-full border-2 border-[var(--line)] bg-[var(--surface-2)]">
                <div
                  className="h-full bg-[var(--brand)]"
                  style={{ width: `${dimension.score * 10}%` }}
                />
              </div>
              {dimension.findingIds.length > 0 ? (
                <ul className="grid gap-2">
                  {report.findings
                    .filter((finding) =>
                      dimension.findingIds.includes(finding.id),
                    )
                    .map((finding) => (
                      <li
                        key={finding.id}
                        className={`grid gap-1 rounded-[var(--radius)] border-2 border-l-[6px] border-[var(--line)] px-3.5 py-2.5 text-sm ${qualityFindingSurface(finding.kind, finding.title)}`}
                      >
                        <p className="font-medium text-[var(--ink)]">
                          {finding.title}
                        </p>
                        <p className="font-mono text-xs text-[var(--muted)]">
                          {finding.path} · L{finding.startLine}–{finding.endLine}
                        </p>
                        <p className="text-[var(--muted)]">{finding.found}</p>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  The files that were read gave no reliable signal here.
                </p>
              )}
            </div>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

function qualityFindingSurface(kind: string, title: string): string {
  if (kind === 'strength') {
    return 'border-[var(--success)] bg-[var(--success-soft)]';
  }
  if (/credential|unsafe|sql|silenced error/i.test(title)) {
    return 'border-[var(--danger)] bg-[var(--danger-soft)]';
  }
  return 'border-[var(--warning)] bg-[var(--warning-soft)]';
}
