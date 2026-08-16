/**
 * Authorship evidence for one repository: which commits in it were written by the GitHub
 * user being analyzed. A forked repository is only portfolio evidence for the parts the
 * user actually wrote, so Proofly resolves that before it reads any code.
 */

/**
 * How a commit was tied to the analyzed account, strongest first. GitHub resolving a
 * commit to a login is authoritative; a bare name match is not, which is why the signal is
 * always reported alongside the count it supports.
 */
export const contributionIdentitySignals = [
  'github-author-login',
  'noreply-email',
  'profile-email',
] as const;

export type ContributionIdentitySignal =
  (typeof contributionIdentitySignals)[number];

export const contributionIdentitySignalLabels: Record<
  ContributionIdentitySignal,
  string
> = {
  'github-author-login': 'GitHub links the commit author to the account',
  'noreply-email': 'Commit email is the account’s GitHub noreply address',
  'profile-email': 'Commit email matches the account’s public profile email',
};

export type ContributionOutcome =
  'verified' | 'no-contributions' | 'unavailable';

/** One branch of the repository, with how much of it the user wrote. */
export interface ContributionBranch {
  name: string;
  isDefault: boolean;
  headSha: string;
  /** Commits on this branch authored by the analyzed user. */
  commits: number;
  lastCommitAt: string | null;
}

export interface ContributionCommit {
  sha: string;
  shortSha: string;
  /** Subject line only. */
  message: string;
  committedAt: string;
  /** Branch this commit was first found on. */
  branch: string;
  /** Every inspected branch that contains this commit. */
  branches: string[];
  htmlUrl: string;
  matchedBy: ContributionIdentitySignal;
  /** Null until the commit's file list has been read. */
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
}

/** A file the user changed, and the newest verified commit ref that changed it. */
export interface ContributionFile {
  path: string;
  /** Git commit ref used for contribution evidence. */
  ref: string;
  branch: string;
  /** How many of the user's commits touched this path. */
  commits: number;
  additions: number;
  deletions: number;
  /** True when the user's last commit on it deleted the file. */
  removed: boolean;
}

export interface UserContributionReport {
  /** Login of the GitHub user whose work was searched for. */
  username: string;
  outcome: ContributionOutcome;
  /** True only when at least one commit was tied to the account. */
  verified: boolean;
  /** Display status, for example "Contribution verified — 12 commits across 2 branches analyzed". */
  status: string;
  /** The same fact as a plain sentence, used when a repository is skipped. */
  reason: string;
  commitCount: number;
  /** Branches that contain at least one commit by the user. */
  branchCount: number;
  /** Branches Proofly actually looked at. */
  branchesInspected: number;
  branches: ContributionBranch[];
  /** The user's verified non-merge commits, most recent first. */
  commits: ContributionCommit[];
  /** Files changed by those commits, most-changed first. */
  files: ContributionFile[];
  additions: number;
  deletions: number;
  firstCommitAt: string | null;
  lastCommitAt: string | null;
  identitySignals: ContributionIdentitySignal[];
  /** Human-readable identity evidence, so the attribution can be checked. */
  identityEvidence: string[];
  /** True when GitHub omitted a text patch for at least one changed file. */
  truncated: boolean;
  /** Set only when the outcome is `unavailable`. */
  unavailableReason: string | null;
}

/**
 * The parts of a contribution report that are cheap enough to attach to every repository
 * in a listing. The full report is only carried by a repository that was analyzed.
 */
export interface UserContributionSummary {
  username: string;
  outcome: ContributionOutcome;
  verified: boolean;
  status: string;
  reason: string;
  commitCount: number;
  branchCount: number;
  branchesInspected: number;
  fileCount: number;
  additions: number;
  deletions: number;
  firstCommitAt: string | null;
  lastCommitAt: string | null;
  identityEvidence: string[];
  /** Changed paths, used to rank a fork from the user's work rather than repo metadata. */
  filePaths: string[];
  /** Languages inferred only from files changed by the user. */
  languages: string[];
}
