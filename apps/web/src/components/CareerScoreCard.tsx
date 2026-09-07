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
    <section className="card mb-8 overflow-hidden">
      <div className="grid gap-8 border-b-2 border-[var(--line)] p-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:p-6">
        <div className="lg:border-r-2 lg:border-dashed lg:border-[var(--hair)] lg:pr-8">
          {/* The label already names the career, so it captions the number directly
              instead of repeating a generic "Overall career score" above it. */}
          <h3 className="label-mono">{portfolio.label}</h3>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="display text-[4.5rem] leading-none tabular-nums text-[var(--ink)]">
              {portfolio.score.toFixed(1)}
            </span>
            <span className="display text-xl text-[var(--muted)]">/ 10</span>
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <BandBadge band={portfolio.band} />
            <span className="label-mono">
              {coverage.deeplyAnalyzed} of {coverage.discovered} repositories
              analyzed
            </span>
          </p>
        </div>

        <div className="grid gap-5">
          <p className="max-w-measure text-base text-[var(--ink)]">
            {portfolio.summary}
          </p>

          <div className="grid gap-5 border-y border-[var(--hair)] py-5 sm:grid-cols-3 sm:divide-x sm:divide-[var(--hair)]">
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
              empty="No repository cleared the strength bar."
            />
            <DriverList
              title="Main gaps"
              items={portfolio.mainGaps}
              tone="negative"
              empty="No recurring gap showed up."
            />
          </div>

          <div>
            <p className="label-mono font-medium text-[var(--ink)]">
              How this is calculated
            </p>
            <p className="mt-1 max-w-measure text-sm text-[var(--muted)]">
              {portfolio.method}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 lg:px-6">
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
              <p className="rounded-[var(--radius)] border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
                GitHub rate-limited the run, so this score only covers the
                repositories that were reached. A GitHub token raises the limit.
              </p>
            ) : null}

            {coverage.skipReasons.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold text-[var(--ink)]">
                  Why repositories were skipped
                </h4>
                <ul className="mt-2 grid gap-1.5">
                  {coverage.skipReasons.map((entry) => (
                    <li key={entry.reason} className="flex gap-3 text-sm">
                      <span className="w-8 shrink-0 text-right font-mono font-semibold tabular-nums text-[var(--ink)]">
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
                Every repository was read in full.
              </p>
            )}
          </div>
        </Collapsible>
      </div>

      {portfolio.contributors.length > 0 ? (
        <div className="border-t border-[var(--hair)] px-5 lg:px-6">
          <Collapsible
            title="How each repository contributed"
            summary={`${portfolio.contributors.length} repositories, by share of the score`}
            defaultOpen
          >
            <ContributorTable contributors={portfolio.contributors} />
          </Collapsible>
        </div>
      ) : null}

      <p className="border-t border-[var(--hair)] px-5 py-3 text-xs text-[var(--muted)] lg:px-6">
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
      <ul className="divide-y divide-[var(--hair)] border-y border-[var(--hair)]">
        {visible.map((contributor) => (
          <li key={contributor.fullName} className="grid gap-3 px-1 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <a
                  className="truncate font-mono text-sm font-medium text-[var(--ink)] hover:text-[var(--brand)] hover:underline"
                  href={contributor.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {contributor.name}
                </a>
                <StatusBadge status={contributor.status} />
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--muted)]">
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
          className="btn focus-control w-fit px-3 py-1.5 text-xs"
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
        <dt className="label-mono">
          {label}:
        </dt>
        <dd
          className={`text-xs tabular-nums ${emphasis ? 'font-semibold text-[var(--ink)]' : 'text-[var(--muted)]'}`}
        >
          {value.toFixed(1)}/10
        </dd>
      </div>
      <div className="h-1 overflow-hidden bg-[var(--hair)]">
        <div
          className={
            emphasis
              ? 'h-full bg-[var(--brand)]'
              : 'h-full bg-[var(--line)]'
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
    skipped: 'bg-[var(--surface-2)] text-[var(--muted)]',
  };

  return (
    <span
      className={`pill ${colors[status]}`}
    >
      {repositoryAnalysisStatusLabels[status]}
    </span>
  );
}

function CoverageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-inset px-4 py-2">
      <dt className="label-mono">{label}</dt>
      <dd className="display mt-1 text-3xl tabular-nums text-[var(--ink)]">
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
    neutral: 'bg-[var(--brand)]',
    negative: 'bg-[var(--warning)]',
  }[tone];

  return (
    <div>
      <h4 className="label-mono flex items-center gap-2 text-[var(--ink)] sm:px-4">
        <span
          className={`size-2.5 rounded-full border-2 border-[var(--line)] ${dot}`}
          aria-hidden="true"
        />
        {title}
      </h4>
      {items.length > 0 ? (
        <ul className="mt-2 grid gap-1">
          {items.map((item) => (
            <li
              key={item}
              className="text-sm leading-6 text-[var(--ink)] sm:px-4"
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
    Limited: 'bg-[var(--surface-2)] text-[var(--muted)]',
  };

  return (
    <span
      className={`pill ${colors[band]}`}
    >
      {band}
    </span>
  );
}
