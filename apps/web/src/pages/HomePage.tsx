import {
  FormEvent,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  careerPathLabels,
  type CareerPath,
  type CareerScoreResponse,
} from '@proofly/shared-types';
import { fetchRankedRepositories } from '../api/prooflyApi.js';
import { streamCareerScore } from '../api/careerScoreStream.js';
import {
  initialPortfolioProgress,
  portfolioProgressReducer,
} from '../lib/portfolioProgress.js';
import { useTheme } from '../lib/useTheme.js';
import { CareerScoreCard } from '../components/CareerScoreCard.js';
import { PortfolioProgress } from '../components/PortfolioProgress.js';
import { ProfileSummary } from '../components/ProfileSummary.js';
import { RepositoryCard } from '../components/RepositoryCard.js';
import { SearchToolbar } from '../components/SearchToolbar.js';
import { ThemeToggle } from '../components/ThemeToggle.js';

const defaultCareerPath: CareerPath = 'software-engineering';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function HomePage() {
  const [usernameInput, setUsernameInput] = useState('');
  const [submittedUsername, setSubmittedUsername] = useState('');
  const [careerPath, setCareerPath] = useState<CareerPath>(defaultCareerPath);
  const { theme, toggleTheme } = useTheme();

  const repositoriesQuery = useQuery({
    queryKey: ['repositories', submittedUsername, careerPath],
    queryFn: () => fetchRankedRepositories(submittedUsername, careerPath),
    enabled: submittedUsername.length > 0,
  });

  const repositories = repositoriesQuery.data?.repositories ?? [];
  const activeCareerPath = repositoriesQuery.data?.careerPath ?? careerPath;

  const [portfolioProgress, dispatchPortfolio] = useReducer(
    portfolioProgressReducer,
    initialPortfolioProgress,
  );
  const [careerScore, setCareerScore] = useState<CareerScoreResponse | null>(
    null,
  );
  const [portfolioPhase, setPortfolioPhase] = useState<
    'idle' | 'running' | 'completing' | 'done'
  >('idle');
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const portfolioAbortRef = useRef<AbortController | null>(null);
  const portfolioHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runPortfolioScore = useCallback(
    async (username: string, careerPath: CareerPath) => {
      portfolioAbortRef.current?.abort();
      const controller = new AbortController();
      portfolioAbortRef.current = controller;

      dispatchPortfolio({ type: 'reset' });
      setCareerScore(null);
      setPortfolioError(null);
      setPortfolioPhase('running');

      try {
        const result = await streamCareerScore(username, careerPath, {
          signal: controller.signal,
          onProgress: (event) => dispatchPortfolio({ type: 'progress', event }),
        });

        if (controller.signal.aborted) {
          return;
        }

        setCareerScore(result);

        if (prefersReducedMotion()) {
          setPortfolioPhase('done');
          return;
        }

        setPortfolioPhase('completing');
        portfolioHoldRef.current = setTimeout(
          () => setPortfolioPhase('done'),
          850,
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setPortfolioError(
          error instanceof Error
            ? error.message
            : 'Proofly could not build a portfolio career score.',
        );
        setPortfolioPhase('idle');
      }
    },
    [],
  );

  // Kicks off only once ranking succeeds, so the repository list is never blocked by the
  // slower file-level portfolio pass.
  useEffect(() => {
    if (
      repositoriesQuery.isSuccess &&
      repositories.length > 0 &&
      submittedUsername
    ) {
      void runPortfolioScore(submittedUsername, activeCareerPath);
    }
  }, [
    activeCareerPath,
    repositories.length,
    repositoriesQuery.isSuccess,
    runPortfolioScore,
    submittedUsername,
  ]);

  useEffect(
    () => () => {
      portfolioAbortRef.current?.abort();
      if (portfolioHoldRef.current) {
        clearTimeout(portfolioHoldRef.current);
      }
    },
    [],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedUsername(usernameInput.trim());
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#e0e7ff,_transparent_30%),linear-gradient(135deg,_#f8fafc,_#eef2ff_55%,_#ecfeff)] px-6 py-10 text-ink transition-colors lg:px-10 lg:py-12 dark:bg-[radial-gradient(circle_at_top_left,_#1e1b4b,_transparent_35%),linear-gradient(135deg,_#020617,_#0b1120_55%,_#041016)] dark:text-slate-100">
      <section className="mx-auto max-w-7xl xl:max-w-[86rem] 2xl:max-w-[92rem]">
        <nav className="mb-11 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              className="size-12 object-contain"
              src="/proofly-logo.svg"
              alt="Proofly logo"
            />
            <div>
              <p className="text-xl font-bold">Proofly</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                portfolio evidence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              className="hidden rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm md:inline-flex dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
            >
              Powered by public GitHub data
            </a>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </nav>

        <div className="grid gap-12 lg:grid-cols-[1.18fr_0.82fr] lg:items-center lg:gap-16">
          <div>
            <p className="mb-6 inline-flex rounded-full bg-white/80 px-5 py-2.5 text-[0.9375rem] font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/25">
              Evidence-backed repository analysis
            </p>
            {/* Sized so the headline settles on three lines from lg upward rather than four. */}
            <h1 className="max-w-4xl text-[3.25rem] font-black leading-[1.05] tracking-tight text-slate-950 md:text-[4rem] lg:text-[4.5rem] xl:text-[4.9rem] dark:text-white">
              See what your GitHub work actually demonstrates.
            </h1>
            <p className="mt-8 max-w-2xl text-xl leading-9 text-slate-600 xl:text-[1.35rem] xl:leading-10 dark:text-slate-300">
              Proofly reads the repository, scores it across six weighted
              categories, and shows you the exact lines of code behind every
              claim it makes.
            </p>
          </div>

          <SearchToolbar
            username={usernameInput}
            onUsernameChange={setUsernameInput}
            careerPath={careerPath}
            onCareerPathChange={setCareerPath}
            onSubmit={handleSubmit}
            isLoading={repositoriesQuery.isFetching}
          />
        </div>

        <section className="mt-12">
          {repositoriesQuery.isError ? (
            <div
              role="alert"
              className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200"
            >
              {(repositoriesQuery.error as Error).message}
            </div>
          ) : null}

          {repositoriesQuery.isFetching ? (
            <div className="rounded-3xl border border-white/80 bg-white/80 p-8 text-slate-600 shadow-soft dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
              Reading public repository metadata for @{submittedUsername}…
            </div>
          ) : null}

          {repositoriesQuery.isSuccess && repositories.length === 0 ? (
            <div className="rounded-3xl border border-white/80 bg-white/80 p-8 text-slate-600 shadow-soft dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
              No public owner repositories found for @{submittedUsername}.
            </div>
          ) : null}

          {repositories.length > 0 ? (
            <div>
              {repositoriesQuery.data?.profile ? (
                <ProfileSummary profile={repositoriesQuery.data.profile} />
              ) : null}

              {portfolioPhase === 'running' ||
              portfolioPhase === 'completing' ? (
                <PortfolioProgress
                  state={portfolioProgress}
                  username={submittedUsername}
                  careerLabel={careerPathLabels[activeCareerPath]}
                  completion={
                    portfolioPhase === 'completing' && careerScore
                      ? {
                          discovered: careerScore.portfolio.coverage.discovered,
                          deeplyAnalyzed:
                            careerScore.portfolio.coverage.deeplyAnalyzed,
                          skipped: careerScore.portfolio.coverage.skipped,
                          score: careerScore.portfolio.score,
                        }
                      : undefined
                  }
                />
              ) : null}

              {portfolioPhase === 'done' && careerScore ? (
                <div className="motion-safe:animate-riseIn">
                  <CareerScoreCard portfolio={careerScore.portfolio} />
                </div>
              ) : null}

              {portfolioError ? (
                <div
                  role="alert"
                  className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200"
                >
                  The overall career score could not be built: {portfolioError}{' '}
                  Repository rankings below are unaffected.
                </div>
              ) : null}

              <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
                    Ranked repositories for @{repositoriesQuery.data?.username}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300">
                    Target career: {careerPathLabels[activeCareerPath]}
                  </p>
                </div>
                <p className="max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Ranking is an evidence fit, not a hiring score. Forks use only
                  verified contribution paths and languages; run the code
                  analysis to see the evidence-backed 0–10 score.
                </p>
              </div>
              <div className="grid gap-5">
                {repositories.map((rankedRepository, index) => (
                  <RepositoryCard
                    key={rankedRepository.repository.id}
                    rankedRepository={rankedRepository}
                    careerPath={activeCareerPath}
                    rank={index + 1}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
