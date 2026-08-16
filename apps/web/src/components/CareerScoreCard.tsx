import { useState } from 'react';
import {
  repositoryAnalysisStatusLabels,
  type CareerPortfolioScore,
  type PortfolioContributor,
  type RelevanceBand,
  type RepositoryAnalysisStatus,
} from '@proofly/shared-types';
import { Collapsible } from './Collapsible.js';

interface CareerScoreCardProps {
  portfolio: CareerPortfolioScore;
}

/** Contributions shown before the user asks for the whole portfolio. */
const initialContributorRows = 12;

export function CareerScoreCard({ portfolio }: CareerScoreCardProps) {
  const { coverage } = portfolio;

  return (
    <section className="surface mb-6 overflow-hidden">
      <div className="grid gap-8 border-b border-[var(--border)] p-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:p-8">
        <div className="lg:border-r lg:border-[var(--border)] lg:pr-8">
          <p className="section-kicker">01 / Portfolio</p>
          <p className="technical-label mt-6">Overall career score</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-7xl font-black tracking-[-0.065em] text-[var(--accent)]">
              {portfolio.score.toFixed(1)}
            </span>
            <span className="text-xl font-semibold text-[var(--muted)]">
              / 10
            </span>
          </p>
          <h3 className="mt-3 text-base font-semibold leading-6 text-[var(--text)]">
            {portfolio.label}
          </h3>
          <p className="mt-4 flex flex-wrap items-center gap-2">
            <BandBadge band={portfolio.band} />
            <span className="technical-label">
              {coverage.deeplyAnalyzed} of {coverage.discovered} repositories
              analyzed
            </span>
          </p>
        </div>

        <div className="grid gap-6">
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted)]">
            {portfolio.summary}
          </p>

          <div className="grid gap-5 border-y border-[var(--border)] py-5 sm:grid-cols-3 sm:divide-x sm:divide-[var(--border)]">
            <DriverList
              title="Strongest evidence"
              items={portfolio.strongestEvidence}
              tone="positive"
              empty="No skill reached strong evidence."
            />
            <DriverList
              title="Portfolio strengths"
              items={portfolio.portfolioStrengths}
              tone="neutral"
              empty="No repository cleared the strength bar yet."
            />
            <DriverList
              title="Main gaps"
              items={portfolio.mainGaps}
              tone="negative"
              empty="No consistent gap was detected."
            />
          </div>

          <div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
              <span>Repository evidence</span>
              <span aria-hidden="true">→</span>
              <span>repository scores</span>
              <span aria-hidden="true">→</span>
              <span className="text-[var(--text)]">portfolio career score</span>
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {portfolio.method}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8">
        <Collapsible
          title="Analysis coverage"
          summary={`${coverage.discovered} discovered · ${coverage.metadataAnalyzed} ranked · ${coverage.deeplyAnalyzed} deeply analyzed · ${coverage.skipped} skipped`}
          badge={
            coverage.rateLimited ? (
              <span className="rounded-[5px] bg-[var(--warning-soft)] px-2 py-1 text-xs font-semibold text-[var(--warning)]">
                Rate limited
              </span>
            ) : undefined
          }
        >
          <div className="grid gap-4">
            <dl className="grid gap-2 sm:grid-cols-4">
              <CoverageStat label="Discovered" value={coverage.discovered} />
              <CoverageStat
                label="Metadata analyzed"
                value={coverage.metadataAnalyzed}
              />
              <CoverageStat
                label="Deeply analyzed"
                value={coverage.deeplyAnalyzed}
              />
              <CoverageStat label="Skipped" value={coverage.skipped} />
            </dl>

            {coverage.rateLimited ? (
              <p className="rounded-[7px] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]">
                GitHub stopped serving requests before every repository could be
                read, so this score reflects only the repositories that were
                reached. Adding a GitHub token raises the limit.
              </p>
            ) : null}

            {coverage.skipReasons.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold text-[var(--text)]">
                  Why repositories were skipped
                </h4>
                <ul className="mt-2 grid gap-1.5">
                  {coverage.skipReasons.map((entry) => (
                    <li key={entry.reason} className="flex gap-3 text-sm">
                      <span className="w-8 shrink-0 text-right font-mono font-semibold tabular-nums text-[var(--text)]">
                        {entry.count}
                      </span>
                      <span className="text-[var(--muted)]">
                        {entry.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Every discovered repository was read in full.
              </p>
            )}
          </div>
        </Collapsible>
      </div>

      {portfolio.contributors.length > 0 ? (
        <div className="border-t border-[var(--border)] px-6 lg:px-8">
          <Collapsible
            title="How each repository contributed"
            summary={`${portfolio.contributors.length} repositories, ordered by their share of the score`}
            defaultOpen
          >
            <ContributorTable contributors={portfolio.contributors} />
          </Collapsible>
        </div>
      ) : null}

      <p className="border-t border-[var(--border)] px-6 py-3 text-xs text-[var(--muted)] lg:px-8">
        {portfolio.disclaimer}
      </p>
    </section>
  );
}

function ContributorTable({
  contributors,
}: {
  contributors: PortfolioContributor[];
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll
    ? contributors
    : contributors.slice(0, initialContributorRows);

  return (
    <div className="grid gap-3">
      <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {visible.map((contributor) => (
          <li key={contributor.fullName} className="grid gap-3 px-1 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <a
                  className="truncate font-mono text-sm font-semibold text-[var(--text)] transition hover:text-[var(--accent)]"
                  href={contributor.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {contributor.name}
                </a>
                <StatusBadge status={contributor.status} />
              </div>
              <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-[var(--accent)]">
                {contributor.contribution > 0
                  ? `${Math.round(contributor.contribution * 100)}% of score`
                  : 'No contribution'}
              </span>
            </div>

            {contributor.strength !== null ? (
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label="Career relevance"
                  value={contributor.careerRelevance}
                />
                <Metric
                  label="Project strength"
                  value={contributor.engineering}
                />
                <Metric
                  label="Career evidence strength"
                  value={contributor.strength}
                  emphasis
                />
                {contributor.prooflyScore !== null ? (
                  <Metric
                    label="Repository score"
                    value={contributor.prooflyScore}
                  />
                ) : null}
              </dl>
            ) : null}

            <p className="text-xs leading-5 text-[var(--muted)]">
              {contributor.explanation}
            </p>
          </li>
        ))}
      </ul>

      {contributors.length > initialContributorRows ? (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className="focus-control w-fit rounded-[7px] border border-[var(--border)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          {showAll
            ? 'Show top contributions only'
            : `Show all ${contributors.length} repositories`}
        </button>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number | null;
  emphasis?: boolean;
}) {
  if (value === null) {
    return null;
  }

  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="technical-label normal-case tracking-normal">
          {label}:
        </dt>
        <dd
          className={`font-mono text-xs tabular-nums ${emphasis ? 'font-bold text-[var(--accent)]' : 'font-semibold text-[var(--text)]'}`}
        >
          {value.toFixed(1)}/10
        </dd>
      </div>
      <div className="h-1 overflow-hidden bg-[var(--border)]">
        <div
          className={
            emphasis
              ? 'h-full bg-[var(--accent)]'
              : 'h-full bg-[var(--border-strong)]'
          }
          style={{ width: `${Math.max(2, value * 10)}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RepositoryAnalysisStatus }) {
  const colors: Record<RepositoryAnalysisStatus, string> = {
    'deeply-analyzed': 'bg-[var(--success-soft)] text-[var(--success)]',
    'metadata-only': 'bg-[var(--warning-soft)] text-[var(--warning)]',
    skipped: 'bg-[var(--surface-subtle)] text-[var(--muted)]',
  };

  return (
    <span
      className={`rounded-[5px] px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide ${colors[status]}`}
    >
      {repositoryAnalysisStatusLabels[status]}
    </span>
  );
}

function CoverageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-l border-[var(--border)] px-4 py-2 first:border-l-0">
      <dt className="technical-label">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-bold tabular-nums text-[var(--text)]">
        {value}
      </dd>
    </div>
  );
}

function DriverList({
  title,
  items,
  tone,
  empty,
}: {
  title: string;
  items: string[];
  tone: 'positive' | 'neutral' | 'negative';
  empty: string;
}) {
  const dot = {
    positive: 'bg-[var(--success)]',
    neutral: 'bg-aurora',
    negative: 'bg-[var(--warning)]',
  }[tone];

  return (
    <div>
      <h4 className="technical-label flex items-center gap-2 sm:px-4">
        <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
        {title}
      </h4>
      {items.length > 0 ? (
        <ul className="mt-2 grid gap-1">
          {items.map((item) => (
            <li
              key={item}
              className="text-sm leading-6 text-[var(--text)] sm:px-4"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:px-4">
          {empty}
        </p>
      )}
    </div>
  );
}

function BandBadge({ band }: { band: RelevanceBand }) {
  const colors: Record<RelevanceBand, string> = {
    Strong: 'bg-[var(--success-soft)] text-[var(--success)]',
    Moderate: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    Limited: 'bg-[var(--surface-subtle)] text-[var(--muted)]',
  };

  return (
    <span
      className={`rounded-[5px] px-2 py-1 font-mono text-xs font-semibold uppercase tracking-wide ${colors[band]}`}
    >
      {band}
    </span>
  );
}
