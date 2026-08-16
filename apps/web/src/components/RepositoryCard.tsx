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
    <article className="rounded-3xl border border-white/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/85 p-5 shadow-soft backdrop-blur sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">
              #{rank}
            </span>
            <a
              className="truncate text-xl font-semibold text-slate-950 dark:text-white hover:text-aurora dark:hover:text-indigo-300"
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
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {repository.description ?? 'No repository description provided.'}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <ScoreTile value={relevanceScore} label="overall match" emphasis />
          <ScoreTile
            value={careerRelevanceScore}
            label={careerRelevanceBand.toLowerCase()}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full bg-slate-900 px-2.5 py-1 font-medium text-white dark:bg-slate-700">
          {repository.language ?? 'Language unknown'}
        </span>
        {topSkills.map((skill) => (
          <span
            key={skill.id}
            title={skill.matchedSignals.join(', ')}
            className={`rounded-full px-2.5 py-1 font-medium ${
              skill.strength === 'strong'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
            }`}
          >
            {skill.label}
          </span>
        ))}
        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-600 dark:text-slate-300">
          ★ {repository.stargazersCount}
        </span>
        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-600 dark:text-slate-300">
          ⑂ {repository.forksCount}
        </span>
      </div>

      <p className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          Why this ranks here:{' '}
        </span>
        {whyThisRanks}
      </p>

      {strongestEvidence ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium text-slate-900 dark:text-slate-100">
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
                className="grid gap-0.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {component.label}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {component.earned}/{component.max}
                  </span>
                </div>
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {component.detail}
                </p>
              </li>
            ))}
          </ul>
        </Collapsible>
      </div>

      <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
        <button
          className="rounded-2xl bg-aurora px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          type="button"
          disabled={isRunning}
          onClick={() => void runAnalysis()}
        >
          {isRunning
            ? 'Reading files…'
            : analysis
              ? 'Re-run file analysis'
              : 'Analyze code and score 0–10'}
        </button>

        {error ? (
          <p
            role="alert"
            className="mt-3 text-sm text-red-700 dark:text-red-300"
          >
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
                    evidenceSignals: analysis.codeEvidence.length,
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
      className={`w-24 rounded-2xl px-3 py-2 text-center ${
        emphasis
          ? 'bg-slate-950 text-white dark:bg-indigo-500'
          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
      }`}
    >
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div
        className={`text-[11px] uppercase leading-tight tracking-wide ${
          emphasis
            ? 'text-slate-300 dark:text-indigo-100'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {label}
      </div>
    </div>
  );
}

function labelClassName(label: RankedRepository['relevanceLabel']): string {
  const base =
    'rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide';

  if (label === 'High') {
    return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`;
  }

  if (label === 'Medium') {
    return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`;
  }

  return `${base} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`;
}
