import type { RepositoryAnalysisResponse } from '@proofly/shared-types';

export function AnalysisOverview({
  analysis,
}: {
  analysis: RepositoryAnalysisResponse;
}) {
  const strengths = analysis.codeQuality.findings
    .filter((finding) => finding.kind === 'strength')
    .slice(0, 3);
  const weaknesses = analysis.codeQuality.findings
    .filter((finding) => finding.kind === 'improvement')
    .slice(0, 3);
  const bestEvidence = analysis.codeEvidence[0];
  const priority = analysis.improvementPlan.actions[0];

  return (
    <div className="grid gap-px bg-[var(--border)] md:grid-cols-2">
      <SummaryBlock title="Top strengths" tone="positive">
        {strengths.length > 0 ? (
          strengths.map((finding) => (
            <SummaryLine
              key={finding.id}
              title={finding.title}
              detail={`${finding.path} · L${finding.startLine}`}
            />
          ))
        ) : (
          <Empty>No source-backed strength was detected in the sample.</Empty>
        )}
      </SummaryBlock>
      <SummaryBlock title="Top weaknesses" tone="warning">
        {weaknesses.length > 0 ? (
          weaknesses.map((finding) => (
            <SummaryLine
              key={finding.id}
              title={finding.title}
              detail={`${finding.path} · ${finding.severity} impact`}
            />
          ))
        ) : (
          <Empty>No high-confidence code weakness was detected.</Empty>
        )}
      </SummaryBlock>
      <SummaryBlock title="Best code evidence" tone="neutral">
        {bestEvidence ? (
          <SummaryLine
            title={bestEvidence.detected}
            detail={`${bestEvidence.path} · L${bestEvidence.startLine}–${bestEvidence.endLine}`}
          />
        ) : (
          <Empty>No career evidence fragment is available.</Empty>
        )}
      </SummaryBlock>
      <SummaryBlock title="Highest-impact improvement" tone="warning">
        {priority ? (
          <SummaryLine
            title={priority.title}
            detail={priority.paths?.[0] ?? priority.detail}
          />
        ) : (
          <Empty>No improvement is supported by the current evidence.</Empty>
        )}
      </SummaryBlock>
    </div>
  );
}

function SummaryBlock({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'positive' | 'warning' | 'neutral';
  children: React.ReactNode;
}) {
  const colors = {
    positive: 'text-[var(--success)]',
    warning: 'text-[var(--warning)]',
    neutral: 'text-[var(--accent)]',
  };
  return (
    <section className={`grid content-start gap-3 p-5 ${overviewBackground(tone)}`}>
      <h3 className={`technical-label font-bold ${colors[tone]}`}>{title}</h3>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function SummaryLine({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      <p className="mt-1 truncate font-mono text-xs text-[var(--muted)]">
        {detail}
      </p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--muted)]">{children}</p>;
}

function overviewBackground(
  tone: 'positive' | 'warning' | 'neutral',
): string {
  if (tone === 'positive') return 'bg-[var(--success-soft)]';
  if (tone === 'warning') return 'bg-[var(--warning-soft)]';
  return 'bg-[var(--surface-subtle)]';
}
