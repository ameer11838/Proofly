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
    <article className="surface p-5 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="technical-label font-bold text-[var(--accent)]">
              Repo / {String(rank).padStart(2, '0')}
            </span>
            <a
              className="truncate font-mono text-lg font-semibold text-[var(--text)] transition hover:text-[var(--accent)]"
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
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {repository.description ?? 'No repository description provided.'}
          </p>
          {repository.fork && repository.userContribution ? (
            <p
              className={`mt-3 border-l-2 px-3 py-2 font-mono text-xs font-semibold ${
                repository.userContribution.verified
                  ? 'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]'
                  : 'border-[var(--border-strong)] bg-[var(--surface-subtle)] text-[var(--muted)]'
              }`}
            >
              {repository.userContribution.status}
              {repository.userContribution.verified
                ? ` · ${repository.userContribution.fileCount} changed file(s) · +${repository.userContribution.additions}/-${repository.userContribution.deletions}`
                : ` · ${repository.userContribution.branchesInspected} branch(es) inspected`}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2">
          <ScoreTile value={relevanceScore} label="overall match" emphasis />
          <ScoreTile
            value={careerRelevanceScore}
            label={careerRelevanceBand.toLowerCase()}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 bg-[var(--surface-subtle)] px-3 py-3 font-mono text-xs">
        <span className="font-semibold uppercase tracking-wide text-[var(--text)]">
          {repository.language ?? 'Language unknown'}
        </span>
        {topSkills.map((skill) => (
          <span
            key={skill.id}
            title={skill.matchedSignals.join(', ')}
            className={`border-l pl-2 font-medium ${
              skill.strength === 'strong'
                ? 'border-[var(--success)] text-[var(--success)]'
                : 'border-[var(--warning)] text-[var(--warning)]'
            }`}
          >
            {skill.label}
          </span>
        ))}
        <span className="text-[var(--muted)]">
          ★ {repository.stargazersCount}
        </span>
        <span className="text-[var(--muted)]">⑂ {repository.forksCount}</span>
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
        <span className="font-semibold text-[var(--text)]">
          Why this ranks here:{' '}
        </span>
        {whyThisRanks}
      </p>

      {strongestEvidence ? (
        <p className="mt-2 border-l-2 border-[var(--accent)] pl-3 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--text)]">
            Strongest evidence:
          </span>{' '}
          {strongestEvidence.label} — {strongestEvidence.value}
        </p>
      ) : null}

      <div className="mt-1">
        <Collapsible
          title="Ranking components"
          summary={`${relevanceScore}/100 from five weighted metadata components`}
        >
          <ul className="grid gap-1.5">
            {components.map((component) => (
              <li
                key={component.label}
                className="grid gap-0.5 border-b border-[var(--border)] px-1 py-2 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-[var(--text)]">
                    {component.label}
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-[var(--text)]">
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

      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <button
          className="primary-action focus-control px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
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
                ? 'Re-run file analysis'
                : 'Analyze code and score 0–10'}
        </button>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-[var(--error)]">
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
}: {
  value: number;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`w-24 border-l px-3 py-1 text-right ${emphasis ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}
    >
      <div
        className={`font-mono text-xl font-bold tabular-nums ${emphasis ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}
      >
        {value}
      </div>
      <div className="technical-label mt-0.5 normal-case tracking-normal">
        {label}
      </div>
    </div>
  );
}

function labelClassName(label: RankedRepository['relevanceLabel']): string {
  const base =
    'rounded-[5px] px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide';

  if (label === 'High') {
    return `${base} bg-[var(--success-soft)] text-[var(--success)]`;
  }

  if (label === 'Medium') {
    return `${base} bg-[var(--warning-soft)] text-[var(--warning)]`;
  }

  return `${base} bg-[var(--surface-subtle)] text-[var(--muted)]`;
}
