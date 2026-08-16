import { scoreCategoryLabels, type CodeEvidence } from '@proofly/shared-types';
import { CodeFragment } from './CodeFragment.js';
import { Collapsible } from './Collapsible.js';

interface CodeEvidenceSectionProps {
  codeEvidence: CodeEvidence[];
}

export function CodeEvidenceSection({
  codeEvidence,
}: CodeEvidenceSectionProps) {
  if (codeEvidence.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
        No source line in the analyzed files matched a tracked technical signal,
        so Proofly has no code fragment to show. Nothing here is inferred.
      </p>
    );
  }

  const byFile = groupByFile(codeEvidence);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Every fragment below is copied verbatim from inspected source
        {codeEvidence.some((item) => item.commitSha)
          ? '; fork evidence contains only lines added by the verified user'
          : ''}
        , with the matched line highlighted.
      </p>
      {byFile.map(([path, items]) => (
        <Collapsible
          key={path}
          title={path}
          summary={items.map((item) => item.detected).join(' · ')}
          badge={
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              {items.length} {items.length === 1 ? 'match' : 'matches'}
            </span>
          }
        >
          <div className="grid gap-5">
            {items.map((evidence) => (
              <article key={evidence.id} className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-aurora/10 dark:bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-aurora dark:text-indigo-300">
                    {evidence.detected}
                  </span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {evidence.skillLabel}
                  </span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {scoreCategoryLabels[evidence.category]}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    lines {evidence.startLine}–{evidence.endLine}
                  </span>
                  {evidence.commitSha ? (
                    <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300">
                      commit {evidence.commitSha.slice(0, 7)}
                    </span>
                  ) : null}
                </div>

                <CodeFragment
                  fragment={evidence.fragment}
                  language={evidence.language}
                  startLine={evidence.startLine}
                  matchOffset={evidence.matchOffset}
                />

                <dl className="grid gap-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-slate-900 dark:text-slate-100">
                      Why it matters
                    </dt>
                    <dd className="text-slate-600 dark:text-slate-300">
                      {evidence.why}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-slate-900 dark:text-slate-100">
                      Score impact
                    </dt>
                    <dd className="text-slate-600 dark:text-slate-300">
                      {evidence.scoreImpact}
                    </dd>
                  </div>
                </dl>

                <a
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:border-aurora hover:text-aurora dark:hover:text-indigo-300"
                  href={evidence.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on GitHub
                  <span aria-hidden="true">↗</span>
                </a>
              </article>
            ))}
          </div>
        </Collapsible>
      ))}
    </div>
  );
}

function groupByFile(codeEvidence: CodeEvidence[]): [string, CodeEvidence[]][] {
  const groups = new Map<string, CodeEvidence[]>();

  for (const evidence of codeEvidence) {
    groups.set(evidence.path, [...(groups.get(evidence.path) ?? []), evidence]);
  }

  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}
