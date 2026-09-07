import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  careerPathLabels,
  type CareerPath,
  type RankedRepository,
  type RepositoryAnalysisResponse,
} from '@proofly/shared-types';
import { streamRepositoryAnalysis } from '../api/analysisStream.js';
import {
  analysisProgressReducer,
  initialAnalysisProgress,
} from '../lib/analysisProgress.js';
import { AnalysisPanel } from './AnalysisPanel.js';
import { AnalysisProgress } from './AnalysisProgress.js';
import { Collapsible } from './Collapsible.js';

/** How long the "analysis complete" summary holds before the report replaces it. */
const completionHoldMs = 850;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

interface RepositoryCardProps {
  rankedRepository: RankedRepository;
  careerPath: CareerPath;
  rank: number;
}

export function RepositoryCard({
  rankedRepository,
  careerPath,
  rank,
}: RepositoryCardProps) {
  const {
    repository,
    relevanceLabel,
    relevanceScore,
    components,
    careerRelevanceScore,
    careerRelevanceBand,
    topSkills,
    strongestEvidence,
    whyThisRanks,
  } = rankedRepository;

  const [progress, dispatchProgress] = useReducer(
    analysisProgressReducer,
    initialAnalysisProgress,
  );
  const [analysis, setAnalysis] = useState<RepositoryAnalysisResponse | null>(
    null,
  );
  const [phase, setPhase] = useState<
    'idle' | 'running' | 'completing' | 'done'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (holdRef.current) {
        clearTimeout(holdRef.current);
      }
    },
    [],
  );

  // A report is only valid for the career it was requested with. The card stays mounted
  // when the target career changes, so the previous result has to be cleared.
  useEffect(() => {
    abortRef.current?.abort();
    dispatchProgress({ type: 'reset' });
    setAnalysis(null);
    setError(null);
    setPhase('idle');
  }, [careerPath]);

  const runAnalysis = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatchProgress({ type: 'reset' });
    setAnalysis(null);
    setError(null);
    setPhase('running');

    try {
      const result = await streamRepositoryAnalysis(
        repository.owner.login,
        repository.name,
        careerPath,
        {
          signal: controller.signal,
          onProgress: (event) => dispatchProgress({ type: 'progress', event }),
        },
      );

      if (controller.signal.aborted) {
        return;
      }

      setAnalysis(result);

      // The closing beat is a transition, not padding: the report is already in hand, and
      // a reduced-motion visitor skips straight to it.
      if (prefersReducedMotion()) {
        setPhase('done');
        return;
      }

      setPhase('completing');
      holdRef.current = setTimeout(() => setPhase('done'), completionHoldMs);
    } catch (streamError) {
      if (controller.signal.aborted) {
        return;
      }

      setError(
        streamError instanceof Error
          ? streamError.message
          : 'Proofly could not analyze this repository.',
      );
      setPhase('idle');
    }
  }, [careerPath, repository.name, repository.owner.login]);

  const isRunning = phase === 'running' || phase === 'completing';

  return (
    <article className="card p-5 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="pill bg-[var(--surface-3)] tabular-nums">
              {String(rank).padStart(2, '0')}
            </span>
            <a
              className="display truncate text-xl text-[var(--ink)] underline-offset-4 hover:text-[var(--brand)] hover:underline"
              href={repository.htmlUrl}
              target="_blank"
              rel="noreferrer"
            >
              {repository.name}
            </a>
            <span className={labelClassName(relevanceLabel)}>
              {relevanceLabel} match
            </span>
          </div>
          <p className="mt-2 max-w-measure text-sm text-[var(--muted)]">
            {repository.description ?? 'No description.'}
          </p>
          {repository.fork && repository.userContribution ? (
            <p
              className={`mt-3 rounded-[var(--radius)] border-2 border-l-[6px] px-3 py-2 font-mono text-xs font-semibold ${
                repository.userContribution.verified
                  ? 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]'
                  : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)]'
              }`}
            >
              {repository.userContribution.status}
              {repository.userContribution.verified
                ? ` · ${repository.userContribution.fileCount} files changed · +${repository.userContribution.additions}/−${repository.userContribution.deletions}`
                : ` · ${plural(repository.userContribution.branchesInspected, 'branch', 'branches')} inspected`}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2">
          <ScoreTile value={`${relevanceScore}/100`} label="match" emphasis />
          <ScoreTile
            value={`${careerRelevanceScore}%`}
            label="career fit"
            title={`${careerRelevanceBand} career relevance`}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 border-y-2 border-dashed border-[var(--hair)] py-2.5 text-xs">
        <span className="pill bg-[var(--brand-soft)] text-[var(--brand)]">
          {repository.language ?? 'Language unknown'}
        </span>
        {topSkills.map((skill) => (
          <span
            key={skill.id}
            title={skill.matchedSignals.join(', ')}
            className={`pill ${
              skill.strength === 'strong'
                ? 'bg-[var(--success-soft)] text-[var(--success)]'
                : 'bg-[var(--warning-soft)] text-[var(--warning)]'
            }`}
          >
            {skill.label}
          </span>
        ))}
        <span className="ml-auto text-[var(--muted)] tabular-nums">
          {repository.stargazersCount} stars · {repository.forksCount} forks
        </span>
      </div>

      <p className="mt-3 max-w-measure text-sm text-[var(--muted)]">
        <span className="font-medium text-[var(--ink)]">
          Why this ranks here:{' '}
        </span>
        {whyThisRanks}
      </p>

      {strongestEvidence ? (
        <p className="mt-1.5 max-w-measure text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">
            Strongest evidence:
          </span>{' '}
          {strongestEvidence.label} — {strongestEvidence.value}
        </p>
      ) : null}

      <div className="mt-1">
        <Collapsible
          title="Ranking components"
          summary={`${relevanceScore}/100 across five weighted metadata signals`}
        >
          <ul className="grid gap-1.5">
            {components.map((component) => (
              <li
                key={component.label}
                className="grid gap-0.5 border-b border-[var(--hair)] px-1 py-2 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-[var(--ink)]">
                    {component.label}
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-[var(--ink)]">
                    {component.earned}/{component.max}
                  </span>
                </div>
                <p className="text-xs leading-5 text-[var(--muted)]">
                  {component.detail}
                </p>
              </li>
            ))}
          </ul>
        </Collapsible>
      </div>

      <div className="mt-4 border-t border-[var(--hair)] pt-4">
        <button
          className="btn btn-primary focus-control h-11 px-5 text-sm uppercase tracking-wide"
          type="button"
          disabled={
            isRunning ||
            (repository.fork && !repository.userContribution?.verified)
          }
          onClick={() => void runAnalysis()}
        >
          {repository.fork && !repository.userContribution?.verified
            ? 'No verified contributions'
            : isRunning
              ? 'Reading files…'
              : analysis
                ? 'Re-run analysis'
                : 'Analyze the code'}
        </button>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        {isRunning ? (
          <AnalysisProgress
            state={progress}
            repositoryFullName={repository.fullName}
            careerLabel={careerPathLabels[careerPath]}
            completion={
              phase === 'completing' && analysis
                ? {
                    filesAnalyzed: analysis.fileReport.analyzedCount,
                    evidenceSignals:
                      analysis.codeEvidence.length +
                      analysis.codeQuality.findings.length,
                    careerSkills: analysis.careerRelevance.skills.filter(
                      (skill) => skill.strength === 'strong',
                    ).length,
                    score: analysis.rating.score,
                  }
                : undefined
            }
          />
        ) : null}

        {phase === 'done' && analysis ? (
          <div className="motion-safe:animate-riseIn">
            <AnalysisPanel analysis={analysis} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ScoreTile({
  value,
  label,
  emphasis = false,
  title,
}: {
  value: string;
  label: string;
  emphasis?: boolean;
  title?: string;
}) {
  return (
    <div
      title={title}
      className={`min-w-24 rounded-[var(--radius)] border-2 border-[var(--line)] px-3 py-1.5 text-right ${
        emphasis
          ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
          : 'bg-[var(--surface-2)] text-[var(--ink)]'
      }`}
    >
      <div className="display text-xl tabular-nums">
        {value}
      </div>
      <div className="label-mono mt-0.5 text-current opacity-70">{label}</div>
    </div>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function labelClassName(label: RankedRepository['relevanceLabel']): string {
  const base = 'pill';

  if (label === 'High') {
    return `${base} bg-[var(--success-soft)] text-[var(--success)]`;
  }

  if (label === 'Medium') {
    return `${base} bg-[var(--warning-soft)] text-[var(--warning)]`;
  }

  return `${base} bg-[var(--surface-2)] text-[var(--muted)]`;
}
