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
    <main className="min-h-screen bg-[var(--page)] px-5 py-5 text-[var(--text)] sm:px-8 lg:px-10">
      <section className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-2.5">
            <img
              className="size-8 object-contain"
              src="/proofly-logo.svg"
              alt=""
            />
            <p className="text-base font-semibold">Proofly</p>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </nav>

        {/* Roomy while the form is the only thing on the page; tighter once results
            arrive, so it stops competing with them. */}
        <div
          className={`grid gap-8 py-10 lg:grid-cols-[1fr_25rem] lg:items-center lg:gap-16 ${
            submittedUsername ? 'lg:py-10' : 'lg:py-24'
          }`}
        >
          <div>
            {/* Scales with the viewport so it neither shouts on a desktop nor
                shrinks to body copy on a laptop; `text-balance` keeps the line
                breaks even at every width instead of leaving a short last line. */}
            <h1 className="text-balance text-[clamp(2.125rem,1.4rem+2.1vw,3.125rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-[var(--text)]">
              Score your GitHub repositories against a career track.
            </h1>
            <p className="mt-5 max-w-measure-tight text-lg text-[var(--muted)]">
              Every score links back to the file and line it came from, so you
              can see what it was based on.
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
            <div className="surface p-5 text-sm text-[var(--muted)]">
              Reading public repositories for @{submittedUsername}…
            </div>
          ) : null}

          {repositoriesQuery.isSuccess && repositories.length === 0 ? (
            <div className="surface p-5 text-sm text-[var(--muted)]">
              @{submittedUsername} has no public repositories of their own.
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
                  Could not build the overall career score: {portfolioError}{' '}
                  The rankings below are unaffected.
                </div>
              ) : null}

              <div className="mb-4 mt-10 flex flex-col gap-3 border-b border-[var(--border)] pb-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-[var(--text)]">
                    Ranked repositories for @{repositoriesQuery.data?.username}
                  </h2>
                  <p className="field-label mt-1">
                    Target career: {careerPathLabels[activeCareerPath]}
                  </p>
                </div>
                <p className="max-w-measure-tight text-sm text-[var(--muted)]">
                  Ranking uses repository metadata. Run the code analysis on a
                  repository to score it from its source.
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
