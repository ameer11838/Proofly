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
      <SummaryBlock title="Strengths" tone="positive">
        {strengths.length > 0 ? (
          strengths.map((finding) => (
            <SummaryLine
              key={finding.id}
              title={finding.title}
              detail={`${finding.path} · L${finding.startLine}`}
            />
          ))
        ) : (
          <Empty>No strength found in the files that were read.</Empty>
        )}
      </SummaryBlock>
      <SummaryBlock title="Weaknesses" tone="warning">
        {weaknesses.length > 0 ? (
          weaknesses.map((finding) => (
            <SummaryLine
              key={finding.id}
              title={finding.title}
              detail={`${finding.path} · ${finding.severity} impact`}
            />
          ))
        ) : (
          <Empty>No clear weakness found.</Empty>
        )}
      </SummaryBlock>
      <SummaryBlock title="Strongest evidence" tone="neutral">
        {bestEvidence ? (
          <SummaryLine
            title={bestEvidence.detected}
            detail={`${bestEvidence.path} · L${bestEvidence.startLine}–${bestEvidence.endLine}`}
          />
        ) : (
          <Empty>No career evidence found.</Empty>
        )}
      </SummaryBlock>
      <SummaryBlock title="Top improvement" tone="warning">
        {priority ? (
          <SummaryLine
            title={priority.title}
            detail={priority.paths?.[0] ?? priority.detail}
            mono={priority.paths !== undefined && priority.paths.length > 0}
          />
        ) : (
          <Empty>Nothing to improve based on what was read.</Empty>
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
    positive: 'bg-[var(--success)]',
    warning: 'bg-[var(--warning)]',
    neutral: 'bg-[var(--accent)]',
  };
  return (
    <section className="grid min-w-0 content-start gap-3 bg-[var(--surface)] p-4">
      <h3 className="flex items-center gap-2 field-label font-medium text-[var(--text)]">
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${colors[tone]}`}
        />
        {title}
      </h3>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

/** `mono` marks a file path; anything else is prose and wraps instead of truncating. */
function SummaryLine({
  title,
  detail,
  mono = true,
}: {
  title: string;
  detail: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-[var(--text)]">{title}</p>
      <p
        className={`mt-1 text-xs text-[var(--muted)] ${
          mono ? 'truncate font-mono' : 'leading-5'
        }`}
      >
        {detail}
      </p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--muted)]">{children}</p>;
}
