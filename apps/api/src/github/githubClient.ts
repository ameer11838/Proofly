import type {
  GitHubRepository,
  GitHubUserProfile,
} from '@proofly/shared-types';

interface GitHubApiRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  size: number;
  default_branch: string;
  license: { name: string } | null;
  pushed_at: string | null;
  updated_at: string;
  created_at: string;
  archived: boolean;
  fork: boolean;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
}

interface GitHubApiUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  email: string | null;
}

export interface GitHubBranch {
  name: string;
  headSha: string;
}

export interface GitHubCommitSummary {
  sha: string;
  htmlUrl: string;
  message: string;
  author: { name: string; email: string; date: string } | null;
  committer: { name: string; email: string; date: string } | null;
  authorLogin: string | null;
  parentCount: number;
}

export interface GitHubCommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
}

export interface GitHubCommitDetail extends GitHubCommitSummary {
  files: GitHubCommitFile[];
}

interface GitHubApiCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string } | null;
    committer: { name: string; email: string; date: string } | null;
  };
  author: { login: string } | null;
  parents: Array<{ sha: string }>;
  files?: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
  }>;
}

interface GitHubTreeResponse {
  truncated: boolean;
  tree: GitHubTreeItem[];
}

export interface GitHubTreeItem {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  size?: number;
}

export class GitHubClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

export interface GitHubClientOptions {
  token?: string;
  timeoutMs?: number;
}

export class GitHubClient {
  private readonly token?: string;
  private readonly timeoutMs: number;

  constructor(options: GitHubClientOptions = {}) {
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async getUserProfile(username: string): Promise<GitHubUserProfile> {
    const profile = await this.requestJson<GitHubApiUser>(
      `https://api.github.com/users/${username}`,
      'GitHub user was not found.',
    );

    return {
      id: profile.id,
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatar_url,
      profileUrl: profile.html_url,
      bio: profile.bio,
      company: profile.company,
      location: profile.location,
      blog: profile.blog,
      publicRepos: profile.public_repos,
      followers: profile.followers,
      following: profile.following,
      createdAt: profile.created_at,
      email: profile.email,
    };
  }

  async listPublicRepositories(username: string): Promise<GitHubRepository[]> {
    const url = new URL(`https://api.github.com/users/${username}/repos`);
    url.searchParams.set('type', 'owner');
    url.searchParams.set('sort', 'updated');
    url.searchParams.set('per_page', '100');

    const repositories = await this.requestJson<GitHubApiRepository[]>(
      url.toString(),
      'GitHub user was not found.',
    );
    return repositories.map(mapRepository);
  }

  async getRepository(
    owner: string,
    repository: string,
  ): Promise<GitHubRepository> {
    const result = await this.requestJson<GitHubApiRepository>(
      `https://api.github.com/repos/${owner}/${repository}`,
      'GitHub repository was not found.',
    );

    return mapRepository(result);
  }

  async getRepositoryTree(
    owner: string,
    repository: string,
    ref: string,
  ): Promise<GitHubTreeItem[]> {
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repository}/git/trees/${ref}`,
    );
    url.searchParams.set('recursive', '1');

    const result = await this.requestJson<GitHubTreeResponse>(
      url.toString(),
      'GitHub repository tree was not found.',
    );

    return result.tree;
  }

  async getRawFile(
    owner: string,
    repository: string,
    ref: string,
    path: string,
  ): Promise<string> {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const encodedRef = encodeURIComponent(ref);
    const response = await this.request(
      `https://raw.githubusercontent.com/${owner}/${repository}/${encodedRef}/${encodedPath}`,
      'GitHub file was not found.',
    );

    return response.text();
  }

  /** Lists every branch, following GitHub pagination until no page remains. */
  async listRepositoryBranches(
    owner: string,
    repository: string,
  ): Promise<GitHubBranch[]> {
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repository}/branches`,
    );
    const branches = await this.requestAllPages<{
      name: string;
      commit: { sha: string };
    }>(url, 'GitHub repository branches were not found.');
    return branches.map((branch) => ({
      name: branch.name,
      headSha: branch.commit.sha,
    }));
  }

  /** Lists all commits reachable from a branch that GitHub associates with an author. */
  async listRepositoryCommitsByAuthor(
    owner: string,
    repository: string,
    branch: string,
    author: string,
  ): Promise<GitHubCommitSummary[]> {
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repository}/commits`,
    );
    url.searchParams.set('sha', branch);
    url.searchParams.set('author', author);
    const commits = await this.requestAllPages<GitHubApiCommit>(
      url,
      'GitHub repository commits were not found.',
    );
    return commits.map(mapCommit);
  }

  async getRepositoryCommit(
    owner: string,
    repository: string,
    sha: string,
  ): Promise<GitHubCommitDetail> {
    const baseUrl = new URL(
      `https://api.github.com/repos/${owner}/${repository}/commits/${sha}`,
    );
    const files: NonNullable<GitHubApiCommit['files']> = [];
    let commit: GitHubApiCommit | null = null;
    let page = 1;
    while (true) {
      const url = new URL(baseUrl);
      url.searchParams.set('per_page', '100');
      url.searchParams.set('page', String(page));
      const result = await this.requestJson<GitHubApiCommit>(
        url.toString(),
        'GitHub commit was not found.',
      );
      commit ??= result;
      const pageFiles = result.files ?? [];
      files.push(...pageFiles);
      if (pageFiles.length < 100) break;
      page += 1;
    }

    return {
      ...mapCommit(commit),
      files: files.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch ?? null,
      })),
    };
  }

  private async requestAllPages<T>(
    initialUrl: URL,
    notFoundMessage: string,
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;

    while (true) {
      const url = new URL(initialUrl);
      url.searchParams.set('per_page', '100');
      url.searchParams.set('page', String(page));
      const values = await this.requestJson<T[]>(
        url.toString(),
        notFoundMessage,
      );
      results.push(...values);
      if (values.length < 100) break;
      page += 1;
    }

    return results;
  }

  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'proofly-local-mvp',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async requestJson<T>(
    url: string,
    notFoundMessage: string,
  ): Promise<T> {
    const response = await this.request(url, notFoundMessage);
    return response.json() as Promise<T>;
  }

  private async request(
    url: string,
    notFoundMessage: string,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: this.buildHeaders(),
      });

      if (response.status === 404) {
        throw new GitHubClientError(notFoundMessage, 404, 'GITHUB_NOT_FOUND');
      }

      if (response.status === 403) {
        throw new GitHubClientError(
          'GitHub rate limit reached. Add a GITHUB_TOKEN to the API environment and try again.',
          429,
          'GITHUB_RATE_LIMITED',
        );
      }

      if (!response.ok) {
        throw new GitHubClientError(
          'GitHub returned an unexpected error.',
          502,
          'GITHUB_UPSTREAM_ERROR',
        );
      }

      return response;
    } catch (error) {
      if (error instanceof GitHubClientError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new GitHubClientError(
          'GitHub request timed out.',
          504,
          'GITHUB_TIMEOUT',
        );
      }

      throw new GitHubClientError(
        'Unable to reach GitHub.',
        502,
        'GITHUB_NETWORK_ERROR',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function mapCommit(commit: GitHubApiCommit): GitHubCommitSummary {
  return {
    sha: commit.sha,
    htmlUrl: commit.html_url,
    message: commit.commit.message,
    author: commit.commit.author,
    committer: commit.commit.committer,
    authorLogin: commit.author?.login ?? null,
    parentCount: commit.parents?.length ?? 0,
  };
}

function mapRepository(repository: GitHubApiRepository): GitHubRepository {
  return {
    id: repository.id,
    name: repository.name,
    fullName: repository.full_name,
    description: repository.description,
    htmlUrl: repository.html_url,
    homepage: repository.homepage,
    language: repository.language,
    topics: repository.topics ?? [],
    stargazersCount: repository.stargazers_count,
    forksCount: repository.forks_count,
    watchersCount: repository.watchers_count,
    openIssuesCount: repository.open_issues_count,
    size: repository.size,
    defaultBranch: repository.default_branch,
    licenseName: repository.license?.name ?? null,
    pushedAt: repository.pushed_at,
    updatedAt: repository.updated_at,
    createdAt: repository.created_at,
    archived: repository.archived,
    fork: repository.fork,
    owner: {
      login: repository.owner.login,
      avatarUrl: repository.owner.avatar_url,
      profileUrl: repository.owner.html_url,
    },
  };
}
