import { useQuery } from '@tanstack/react-query';
import type { CareerPath, RankedRepository } from '@proofly/shared-types';
import { fetchRepositoryAnalysis } from '../api/prooflyApi.js';

interface RepositoryCardProps {
  rankedRepository: RankedRepository;
  careerPath: CareerPath;
}

export function RepositoryCard({ rankedRepository, careerPath }: RepositoryCardProps) {
  const { repository, relevanceLabel, relevanceScore, evidence } = rankedRepository;
  const analysisQuery = useQuery({
    queryKey: ['repository-analysis', repository.fullName, careerPath],
    queryFn: () => fetchRepositoryAnalysis(repository.owner.login, repository.name, careerPath),
    enabled: false,
  });

  return (
    <article className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-soft backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              className="text-xl font-semibold text-slate-950 hover:text-aurora"
              href={repository.htmlUrl}
              target="_blank"
              rel="noreferrer"
            >
              {repository.name}
            </a>
            <span className={labelClassName(relevanceLabel)}>{relevanceLabel}</span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {repository.description ?? 'No repository description provided.'}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-white">
          <div className="text-2xl font-bold">{relevanceScore}</div>
          <div className="text-xs uppercase tracking-wide text-slate-300">metadata fit</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full bg-slate-100 px-3 py-1">
          {repository.language ?? 'Language unknown'}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1">★ {repository.stargazersCount}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">⑂ {repository.forksCount}</span>
        {repository.topics.slice(0, 4).map((topic) => (
          <span key={topic} className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700">
            {topic}
          </span>
        ))}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-800">Evidence used for this ranking</h3>
        <ul className="mt-3 grid gap-2">
          {evidence.map((item) => (
            <li key={`${item.label}-${item.value}`} className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{item.label}:</span> {item.value}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <button
          className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={analysisQuery.isFetching}
          onClick={() => void analysisQuery.refetch()}
        >
          {analysisQuery.isFetching ? 'Analyzing code…' : 'Analyze code and rate 1–10'}
        </button>

        {analysisQuery.isError ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {(analysisQuery.error as Error).message}
          </p>
        ) : null}

        {analysisQuery.data ? (
          <div className="mt-5 rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
                  Repository evidence rating
                </p>
                <h3 className="mt-1 text-3xl font-black text-slate-950">
                  {analysisQuery.data.rating.score}/10 · {analysisQuery.data.rating.label}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {analysisQuery.data.rating.summary}
                </p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                {analysisQuery.data.analyzedFiles.length} files sampled ·{' '}
                {analysisQuery.data.ignoredFilesCount} ignored
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="font-semibold text-slate-900">Why this rating?</h4>
                <ul className="mt-2 grid gap-2 text-sm text-slate-700">
                  {analysisQuery.data.rating.reasoning.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Top suggestions</h4>
                <ul className="mt-2 grid gap-2 text-sm text-slate-700">
                  {analysisQuery.data.suggestions.map((suggestion) => (
                    <li key={suggestion}>• {suggestion}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {analysisQuery.data.findings.map((finding) => (
                <details key={`${finding.category}-${finding.explanation}`} className="rounded-2xl bg-white p-4">
                  <summary className="cursor-pointer font-semibold text-slate-900">
                    {finding.category} · {finding.importance}
                  </summary>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{finding.explanation}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-medium">Recommendation:</span> {finding.recommendation}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {finding.evidence.map((item) => (
                      <span
                        key={`${item.label}-${item.path ?? ''}-${item.line ?? ''}`}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                      >
                        {item.path ?? item.label}
                        {item.line ? `:${item.line}` : ''}
                      </span>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function labelClassName(label: RankedRepository['relevanceLabel']): string {
  const base = 'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide';

  if (label === 'High') {
    return `${base} bg-emerald-100 text-emerald-700`;
  }

  if (label === 'Medium') {
    return `${base} bg-amber-100 text-amber-700`;
  }

  return `${base} bg-slate-100 text-slate-600`;
}
