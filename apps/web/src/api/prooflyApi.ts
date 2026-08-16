import type {
  CareerPath,
  CareerScoreResponse,
  RepositoryAnalysisResponse,
  RepositoryListResponse,
} from '@proofly/shared-types';

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export async function fetchRankedRepositories(
  username: string,
  careerPath: CareerPath,
): Promise<RepositoryListResponse> {
  const response = await fetch(
    `${apiBaseUrl}/api/github/users/${encodeURIComponent(username)}/repos?careerPath=${careerPath}`,
  );

  const body = (await response.json()) as
    RepositoryListResponse | { error?: { message?: string } };

  if (!response.ok) {
    const errorMessage = 'error' in body ? body.error?.message : undefined;
    throw new Error(errorMessage ?? 'Unable to fetch repositories.');
  }

  return body as RepositoryListResponse;
}

export async function fetchCareerScore(
  username: string,
  careerPath: CareerPath,
): Promise<CareerScoreResponse> {
  const response = await fetch(
    `${apiBaseUrl}/api/github/users/${encodeURIComponent(username)}/career-score?careerPath=${careerPath}`,
  );

  const body = (await response.json()) as
    CareerScoreResponse | { error?: { message?: string } };

  if (!response.ok) {
    const errorMessage = 'error' in body ? body.error?.message : undefined;
    throw new Error(
      errorMessage ?? 'Unable to build a portfolio career score.',
    );
  }

  return body as CareerScoreResponse;
}

export async function fetchRepositoryAnalysis(
  owner: string,
  repo: string,
  careerPath: CareerPath,
): Promise<RepositoryAnalysisResponse> {
  const response = await fetch(
    `${apiBaseUrl}/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/analysis?careerPath=${careerPath}`,
  );

  const body = (await response.json()) as
    RepositoryAnalysisResponse | { error?: { message?: string } };

  if (!response.ok) {
    const errorMessage = 'error' in body ? body.error?.message : undefined;
    throw new Error(errorMessage ?? 'Unable to analyze repository.');
  }

  return body as RepositoryAnalysisResponse;
}
