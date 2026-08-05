import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { careerPathLabels, type CareerPath } from '@proofly/shared-types';
import { fetchRankedRepositories } from '../api/prooflyApi.js';
import { CareerSelect } from '../components/CareerSelect.js';
import { ProfileSummary } from '../components/ProfileSummary.js';
import { RepositoryCard } from '../components/RepositoryCard.js';

const defaultCareerPath: CareerPath = 'software-engineering';

export function HomePage() {
  const [usernameInput, setUsernameInput] = useState('');
  const [submittedUsername, setSubmittedUsername] = useState('');
  const [careerPath, setCareerPath] = useState<CareerPath>(defaultCareerPath);

  const repositoriesQuery = useQuery({
    queryKey: ['repositories', submittedUsername, careerPath],
    queryFn: () => fetchRankedRepositories(submittedUsername, careerPath),
    enabled: submittedUsername.length > 0,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedUsername(usernameInput.trim());
  }

  const repositories = repositoriesQuery.data?.repositories ?? [];

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#e0e7ff,_transparent_30%),linear-gradient(135deg,_#f8fafc,_#eef2ff_55%,_#ecfeff)] px-6 py-10 text-ink">
      <section className="mx-auto max-w-6xl">
        <nav className="mb-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-slate-950 text-lg font-black text-white">
              P
            </div>
            <div>
              <p className="text-lg font-bold">Proofly</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">portfolio evidence</p>
            </div>
          </div>
          <a
            className="hidden rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm md:inline-flex"
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
          >
            Powered by public GitHub data
          </a>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-100">
              MVP slice: deterministic repository ranking
            </p>
            <h1 className="max-w-3xl text-5xl font-black tracking-tight text-slate-950 md:text-7xl">
              See what your GitHub work actually demonstrates.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Enter a public GitHub username, choose a target technology career, and Proofly ranks
              repositories using visible evidence like languages, topics, activity, and descriptions.
            </p>
          </div>

          <form
            className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-soft backdrop-blur"
            onSubmit={handleSubmit}
          >
            <div className="grid gap-5">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                GitHub username
                <input
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-aurora focus:ring-4 focus:ring-indigo-100"
                  placeholder="octocat"
                  value={usernameInput}
                  onChange={(event) => setUsernameInput(event.target.value)}
                />
              </label>
              <CareerSelect value={careerPath} onChange={setCareerPath} />
              <button
                className="rounded-2xl bg-slate-950 px-5 py-4 font-semibold text-white shadow-lg shadow-slate-300 transition hover:-translate-y-0.5 hover:bg-aurora disabled:cursor-not-allowed disabled:opacity-60"
                disabled={repositoriesQuery.isFetching || usernameInput.trim().length === 0}
                type="submit"
              >
                {repositoriesQuery.isFetching ? 'Reading GitHub…' : 'Rank repositories'}
              </button>
            </div>
          </form>
        </div>

        <section className="mt-12">
          {repositoriesQuery.isError ? (
            <div role="alert" className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-800">
              {(repositoriesQuery.error as Error).message}
            </div>
          ) : null}

          {repositoriesQuery.isFetching ? (
            <div className="rounded-3xl border border-white/80 bg-white/80 p-8 text-slate-600 shadow-soft">
              Analyzing public repository metadata. Tiny detective hat: on.
            </div>
          ) : null}

          {repositoriesQuery.isSuccess && repositories.length === 0 ? (
            <div className="rounded-3xl border border-white/80 bg-white/80 p-8 text-slate-600 shadow-soft">
              No public owner repositories found for @{submittedUsername}.
            </div>
          ) : null}

          {repositories.length > 0 ? (
            <div>
              {repositoriesQuery.data?.profile ? (
                <ProfileSummary profile={repositoriesQuery.data.profile} />
              ) : null}
              <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">
                    Ranked repositories for @{repositoriesQuery.data?.username}
                  </h2>
                  <p className="text-slate-600">
                    Target career: {careerPathLabels[repositoriesQuery.data?.careerPath ?? careerPath]}
                  </p>
                </div>
                <p className="max-w-xl text-sm leading-6 text-slate-500">
                  This is a transparent metadata fit, not a hiring score. Deeper evidence-backed
                  repository analysis comes next.
                </p>
              </div>
              <div className="grid gap-5">
                {repositories.map((rankedRepository) => (
                  <RepositoryCard
                    key={rankedRepository.repository.id}
                    rankedRepository={rankedRepository}
                    careerPath={repositoriesQuery.data?.careerPath ?? careerPath}
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
