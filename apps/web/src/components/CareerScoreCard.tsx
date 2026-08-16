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
    <section className="mb-6 overflow-hidden rounded-3xl border border-indigo-200/70 bg-white shadow-soft dark:border-indigo-500/25 dark:bg-slate-900">
      {/* Accent bar marks this as the portfolio-level score rather than a repository score. */}
      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-aurora to-violet-500" />

      <div className="grid gap-6 p-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-8 lg:p-7">
        <div className="lg:border-r lg:border-slate-200 lg:pr-8 dark:lg:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aurora dark:text-indigo-300">
            Portfolio assessment
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
            {portfolio.label}
          </h3>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="bg-gradient-to-br from-blue-600 to-violet-600 bg-clip-text text-6xl font-black tracking-tight text-transparent dark:from-blue-400 dark:to-violet-400">
              {portfolio.score.toFixed(1)}
            </span>
            <span className="text-xl font-semibold text-slate-400 dark:text-slate-500">
              / 10
            </span>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <BandBadge band={portfolio.band} />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {coverage.deeplyAnalyzed} of {coverage.discovered} repositories
              analyzed
            </span>
          </p>
        </div>

        <div className="grid gap-5">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            {portfolio.summary}
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
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

          <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Repository evidence</span>
              <span aria-hidden="true">→</span>
              <span>repository scores</span>
              <span aria-hidden="true">→</span>
              <span className="text-slate-900 dark:text-slate-200">
                portfolio career score
              </span>
            </p>
            <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {portfolio.method}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 dark:border-slate-800">
        <Collapsible
          title="Analysis coverage"
          summary={`${coverage.discovered} discovered · ${coverage.metadataAnalyzed} ranked · ${coverage.deeplyAnalyzed} deeply analyzed · ${coverage.skipped} skipped`}
          badge={
            coverage.rateLimited ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
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
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                GitHub stopped serving requests before every repository could be
                read, so this score reflects only the repositories that were
                reached. Adding a GitHub token raises the limit.
              </p>
            ) : null}

            {coverage.skipReasons.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Why repositories were skipped
                </h4>
                <ul className="mt-2 grid gap-1.5">
                  {coverage.skipReasons.map((entry) => (
                    <li key={entry.reason} className="flex gap-3 text-sm">
                      <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {entry.count}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {entry.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Every discovered repository was read in full.
              </p>
            )}
          </div>
        </Collapsible>
      </div>

      {portfolio.contributors.length > 0 ? (
        <div className="border-t border-slate-200 px-6 dark:border-slate-800">
          <Collapsible
            title="How each repository contributed"
            summary={`${portfolio.contributors.length} repositories, ordered by their share of the score`}
            defaultOpen
          >
            <ContributorTable contributors={portfolio.contributors} />
          </Collapsible>
        </div>
      ) : null}

      <p className="border-t border-slate-200 px-6 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
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
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {visible.map((contributor) => (
          <li
            key={contributor.fullName}
            className="grid gap-2 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <a
                  className="truncate text-sm font-semibold text-slate-900 hover:text-aurora dark:text-slate-100 dark:hover:text-indigo-300"
                  href={contributor.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {contributor.name}
                </a>
                <StatusBadge status={contributor.status} />
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {contributor.contribution > 0
                  ? `${Math.round(contributor.contribution * 100)}% of score`
                  : 'No contribution'}
              </span>
            </div>

            {contributor.strength !== null ? (
              <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                <Metric
                  label="Career relevance"
                  value={contributor.careerRelevance}
                />
                <Metric
                  label="Engineering evidence"
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

            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              {contributor.explanation}
            </p>
          </li>
        ))}
      </ul>

      {contributors.length > initialContributorRows ? (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className="w-fit rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-aurora hover:text-aurora dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
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
    <div className="flex gap-1.5">
      <dt>{label}:</dt>
      <dd
        className={`tabular-nums ${
          emphasis
            ? 'font-bold text-slate-900 dark:text-slate-100'
            : 'font-semibold'
        }`}
      >
        {value.toFixed(1)}/10
      </dd>
    </div>
  );
}

function StatusBadge({ status }: { status: RepositoryAnalysisStatus }) {
  const colors: Record<RepositoryAnalysisStatus, string> = {
    'deeply-analyzed':
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    'metadata-only':
      'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    skipped:
      'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${colors[status]}`}
    >
      {repositoryAnalysisStatusLabels[status]}
    </span>
  );
}

function CoverageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
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
    positive: 'bg-emerald-500',
    neutral: 'bg-aurora',
    negative: 'bg-amber-500',
  }[tone];

  return (
    <div>
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
        {title}
      </h4>
      {items.length > 0 ? (
        <ul className="mt-2 grid gap-1">
          {items.map((item) => (
            <li
              key={item}
              className="text-sm leading-6 text-slate-700 dark:text-slate-200"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-6 text-slate-400 dark:text-slate-500">
          {empty}
        </p>
      )}
    </div>
  );
}

function BandBadge({ band }: { band: RelevanceBand }) {
  const colors: Record<RelevanceBand, string> = {
    Strong:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    Moderate:
      'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    Limited:
      'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors[band]}`}
    >
      {band}
    </span>
  );
}
