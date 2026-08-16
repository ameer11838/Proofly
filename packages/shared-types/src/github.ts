export interface GitHubOwner {
  login: string;
  avatarUrl: string;
  profileUrl: string;
}

export interface GitHubUserProfile {
  /** Stable numeric GitHub account id, when returned by the API. */
  id?: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string;
  /** Public profile email only. GitHub does not expose private addresses here. */
  email?: string | null;
}

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stargazersCount: number;
  forksCount: number;
  watchersCount: number;
  openIssuesCount: number;
  size: number;
  defaultBranch: string;
  licenseName: string | null;
  pushedAt: string | null;
  updatedAt: string;
  createdAt: string;
  archived: boolean;
  fork: boolean;
  owner: GitHubOwner;
  /** Present for forks once Proofly has checked the analyzed user's authorship. */
  userContribution?: import('./contribution.js').UserContributionSummary;
}
