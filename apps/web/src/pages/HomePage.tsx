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
    <main className="min-h-screen overflow-hidden bg-[var(--page)] px-5 py-6 text-[var(--text)] transition-colors sm:px-8 lg:px-10 lg:py-8">
      <section className="mx-auto max-w-7xl xl:max-w-[84rem]">
        <nav className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div className="flex items-center gap-3">
            <img
              className="size-12 object-contain"
              src="/proofly-logo.svg"
              alt="Proofly logo"
            />
            <div>
              <p className="text-xl font-bold">Proofly</p>
              <p className="technical-label mt-0.5">portfolio evidence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              className="focus-control hidden rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)] md:inline-flex"
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
            >
              Powered by public GitHub data
            </a>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </nav>

        <div className="grid gap-10 py-12 lg:grid-cols-[1.16fr_0.84fr] lg:items-center lg:gap-14 lg:py-16">
          <div className="max-w-3xl">
            <p className="section-kicker mb-5">Proofly / Portfolio evidence</p>
            {/* Sized so the headline settles on three lines from lg upward rather than four. */}
            <h1 className="max-w-4xl text-[3rem] font-black leading-[1.03] tracking-[-0.045em] text-[var(--text)] md:text-[3.8rem] lg:text-[4.25rem] xl:text-[4.6rem]">
              See what your GitHub work actually demonstrates.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)] xl:text-xl">
              Proofly reads the repository, scores how strongly it supports your
              target career across five portfolio-focused categories, and shows
              the exact evidence behind every claim.
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

        <section className="mt-2">
          {repositoriesQuery.isError ? (
            <div
              role="alert"
              className="surface border-[var(--error)] bg-[var(--error-soft)] p-5 text-[var(--error)]"
            >
              {(repositoriesQuery.error as Error).message}
            </div>
          ) : null}

          {repositoriesQuery.isFetching ? (
            <div className="surface p-6 font-mono text-sm text-[var(--muted)]">
              Reading public repository metadata for @{submittedUsername}…
            </div>
          ) : null}

          {repositoriesQuery.isSuccess && repositories.length === 0 ? (
            <div className="surface p-6 text-[var(--muted)]">
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
                  className="mb-6 rounded-[var(--radius)] border border-[var(--warning)] bg-[var(--warning-soft)] p-5 text-sm text-[var(--warning)]"
                >
                  The overall career score could not be built: {portfolioError}{' '}
                  Repository rankings below are unaffected.
                </div>
              ) : null}

              <div className="mb-5 mt-10 flex flex-col gap-3 border-b border-[var(--border)] pb-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="section-kicker mb-2">02 / Repositories</p>
                  <h2 className="text-2xl font-bold text-[var(--text)]">
                    Ranked repositories for @{repositoriesQuery.data?.username}
                  </h2>
                  <p className="technical-label mt-1">
                    Target career: {careerPathLabels[activeCareerPath]}
                  </p>
                </div>
                <p className="max-w-xl text-sm leading-6 text-[var(--muted)]">
                  Ranking is an evidence fit, not a hiring score. Forks use only
                  verified contribution paths and languages; run the code
                  analysis to see the evidence-backed 0–10 score.
                </p>
              </div>
              <div className="grid gap-4">
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
