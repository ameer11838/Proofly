import type {
  ContributionCommit,
  ContributionFile,
  ContributionIdentitySignal,
  GitHubRepository,
  GitHubUserProfile,
  UserContributionReport,
  UserContributionSummary,
} from '@proofly/shared-types';
import type { RepositoryFileEvidence } from '@proofly/analysis-core';
import {
  GitHubClient,
  type GitHubCommitDetail,
  type GitHubCommitSummary,
} from '../github/githubClient.js';

export interface ContributionResolution {
  report: UserContributionReport;
  evidenceFiles: RepositoryFileEvidence[];
}

const resolutionCache = new Map<string, Promise<ContributionResolution>>();
const maxResolutionCacheEntries = 400;
const commitConcurrency = 5;
const branchConcurrency = 4;

/**
 * Verifies a fork against GitHub's commit attribution and extracts only lines added by
 * that account. The promise itself is cached so the ranking and portfolio passes share
 * the same branch/commit scan.
 */
export function resolveForkContributions(
  client: GitHubClient,
  repository: GitHubRepository,
  profile: GitHubUserProfile,
): Promise<ContributionResolution> {
  const key = `${repository.fullName}@${repository.pushedAt ?? 'never'}@${profile.login.toLowerCase()}`;
  const existing = resolutionCache.get(key);
  if (existing) return existing;

  const pending = resolve(client, repository, profile).catch((error) => {
    resolutionCache.delete(key);
    throw error;
  });
  if (resolutionCache.size >= maxResolutionCacheEntries) {
    const oldest = resolutionCache.keys().next();
    if (!oldest.done) resolutionCache.delete(oldest.value);
  }
  resolutionCache.set(key, pending);
  return pending;
}

async function resolve(
  client: GitHubClient,
  repository: GitHubRepository,
  profile: GitHubUserProfile,
): Promise<ContributionResolution> {
  const branches = await client.listRepositoryBranches(
    repository.owner.login,
    repository.name,
  );
  const aliases = identityAliases(profile);
  const occurrences = new Map<
    string,
    {
      commit: GitHubCommitSummary;
      branches: Set<string>;
      matchedBy: ContributionIdentitySignal;
    }
  >();

  await mapWithConcurrency(branches, branchConcurrency, async (branch) => {
    for (const alias of aliases) {
      const commits = await client.listRepositoryCommitsByAuthor(
        repository.owner.login,
        repository.name,
        branch.name,
        alias.value,
      );

      for (const commit of commits) {
        const matchedBy = matchIdentity(commit, profile);
        if (!matchedBy) continue;
        const current = occurrences.get(commit.sha);
        if (current) {
          current.branches.add(branch.name);
        } else {
          occurrences.set(commit.sha, {
            commit,
            branches: new Set([branch.name]),
            matchedBy,
          });
        }
      }
    }
  });

  if (occurrences.size === 0) {
    return {
      report: noContributionReport(
        profile.login,
        branches,
        repository.defaultBranch,
      ),
      evidenceFiles: [],
    };
  }

  // A merge commit's diff can consist entirely of code authored by the merged branch's
  // contributors. It is therefore not safe ownership evidence by itself. The user's
  // original non-merge commits are still discovered on every branch that contains them.
  const ordered = [...occurrences.values()]
    .filter((entry) => entry.commit.parentCount <= 1)
    .sort((a, b) => commitDate(b.commit).localeCompare(commitDate(a.commit)));
  if (ordered.length === 0) {
    return {
      report: noContributionReport(
        profile.login,
        branches,
        repository.defaultBranch,
      ),
      evidenceFiles: [],
    };
  }
  const details = await mapWithConcurrency(
    ordered,
    commitConcurrency,
    ({ commit }) =>
      client.getRepositoryCommit(
        repository.owner.login,
        repository.name,
        commit.sha,
      ),
  );

  const contributionFiles = new Map<string, ContributionFile>();
  const evidenceFiles: RepositoryFileEvidence[] = [];
  let additions = 0;
  let deletions = 0;
  let incompletePatch = false;

  details.forEach((detail, index) => {
    const occurrence = ordered[index];
    if (!occurrence) return;
    const branch = preferredBranch(
      [...occurrence.branches],
      repository.defaultBranch,
    );

    for (const file of detail.files) {
      additions += file.additions;
      deletions += file.deletions;
      const existing = contributionFiles.get(file.filename);
      contributionFiles.set(file.filename, {
        path: file.filename,
        ref: existing?.ref ?? detail.sha,
        branch: existing?.branch ?? branch,
        commits: (existing?.commits ?? 0) + 1,
        additions: (existing?.additions ?? 0) + file.additions,
        deletions: (existing?.deletions ?? 0) + file.deletions,
        removed: existing?.removed ?? file.status === 'removed',
      });

      if (file.patch === null) {
        if (file.changes > 0) incompletePatch = true;
        continue;
      }

      for (const [hunkIndex, hunk] of addedHunks(file.patch).entries()) {
        evidenceFiles.push({
          path: file.filename,
          size: hunk.content.length,
          content: redactSuspectedSecrets(hunk.content),
          ref: detail.sha,
          startLine: hunk.startLine,
          evidenceId: `${detail.sha}:${file.filename}:${hunkIndex}`,
        });
      }
    }
  });

  const commits: ContributionCommit[] = ordered.map((entry, index) => {
    const detail = details[index] as GitHubCommitDetail;
    const branchNames = [...entry.branches].sort();
    return {
      sha: detail.sha,
      shortSha: detail.sha.slice(0, 7),
      message: detail.message.split('\n')[0] ?? '',
      committedAt: commitDate(detail),
      branch: preferredBranch(branchNames, repository.defaultBranch),
      branches: branchNames,
      htmlUrl: detail.htmlUrl,
      matchedBy: entry.matchedBy,
      additions: detail.files.reduce((sum, file) => sum + file.additions, 0),
      deletions: detail.files.reduce((sum, file) => sum + file.deletions, 0),
      changedFiles: detail.files.length,
    };
  });
  const contributingBranches = branches
    .map((branch) => {
      const onBranch = ordered.filter((entry) =>
        entry.branches.has(branch.name),
      );
      return {
        name: branch.name,
        isDefault: branch.name === repository.defaultBranch,
        headSha: branch.headSha,
        commits: onBranch.length,
        lastCommitAt:
          onBranch
            .map((entry) => commitDate(entry.commit))
            .sort()
            .at(-1) ?? null,
      };
    })
    .filter((branch) => branch.commits > 0);
  const identitySignals = [
    ...new Set(commits.map((commit) => commit.matchedBy)),
  ];
  const identityEvidence = identitySignals.map((signal) =>
    signal === 'github-author-login'
      ? `${commits.filter((commit) => commit.matchedBy === signal).length} commit(s) linked by GitHub to @${profile.login}`
      : `${commits.filter((commit) => commit.matchedBy === signal).length} commit(s) matched the account's ${signal === 'profile-email' ? 'public profile email' : 'GitHub noreply address'}`,
  );
  const status = `Contribution verified — ${commits.length} ${commits.length === 1 ? 'commit' : 'commits'} across ${contributingBranches.length} ${contributingBranches.length === 1 ? 'branch' : 'branches'} analyzed`;
  const dates = commits.map((commit) => commit.committedAt).sort();

  return {
    report: {
      username: profile.login,
      outcome: 'verified',
      verified: true,
      status,
      reason: status,
      commitCount: commits.length,
      branchCount: contributingBranches.length,
      branchesInspected: branches.length,
      branches: contributingBranches,
      commits,
      files: [...contributionFiles.values()].sort(
        (a, b) => b.additions + b.deletions - (a.additions + a.deletions),
      ),
      additions,
      deletions,
      firstCommitAt: dates[0] ?? null,
      lastCommitAt: dates.at(-1) ?? null,
      identitySignals,
      identityEvidence,
      truncated: incompletePatch,
      unavailableReason: null,
    },
    evidenceFiles,
  };
}

export function summarizeContribution(
  report: UserContributionReport,
): UserContributionSummary {
  const filePaths = report.files.map((file) => file.path);
  return {
    username: report.username,
    outcome: report.outcome,
    verified: report.verified,
    status: report.status,
    reason: report.reason,
    commitCount: report.commitCount,
    branchCount: report.branchCount,
    branchesInspected: report.branchesInspected,
    fileCount: report.files.length,
    additions: report.additions,
    deletions: report.deletions,
    firstCommitAt: report.firstCommitAt,
    lastCommitAt: report.lastCommitAt,
    identityEvidence: report.identityEvidence,
    filePaths,
    languages: inferLanguages(filePaths),
  };
}

export function unavailableContributionSummary(
  username: string,
  reason = 'GitHub could not verify contributions for this fork.',
): UserContributionSummary {
  return {
    username,
    outcome: 'unavailable',
    verified: false,
    status: `Skipped — ${reason}`,
    reason,
    commitCount: 0,
    branchCount: 0,
    branchesInspected: 0,
    fileCount: 0,
    additions: 0,
    deletions: 0,
    firstCommitAt: null,
    lastCommitAt: null,
    identityEvidence: [],
    filePaths: [],
    languages: [],
  };
}

function identityAliases(profile: GitHubUserProfile): Array<{ value: string }> {
  return [
    ...new Set(
      [
        profile.login,
        profile.email ?? '',
        `${profile.login}@users.noreply.github.com`,
        profile.id
          ? `${profile.id}+${profile.login}@users.noreply.github.com`
          : '',
      ].filter(Boolean),
    ),
  ].map((value) => ({ value }));
}

function noContributionReport(
  username: string,
  branches: Array<{ name: string; headSha: string }>,
  defaultBranch: string,
): UserContributionReport {
  return {
    username,
    outcome: 'no-contributions',
    verified: false,
    status: 'Skipped — No contributions from this GitHub user were found.',
    reason: 'No contributions from this GitHub user were found.',
    commitCount: 0,
    branchCount: 0,
    branchesInspected: branches.length,
    branches: branches.map((branch) => ({
      name: branch.name,
      isDefault: branch.name === defaultBranch,
      headSha: branch.headSha,
      commits: 0,
      lastCommitAt: null,
    })),
    commits: [],
    files: [],
    additions: 0,
    deletions: 0,
    firstCommitAt: null,
    lastCommitAt: null,
    identitySignals: [],
    identityEvidence: [],
    truncated: false,
    unavailableReason: null,
  };
}

function matchIdentity(
  commit: GitHubCommitSummary,
  profile: GitHubUserProfile,
): ContributionIdentitySignal | null {
  if (commit.authorLogin) {
    return commit.authorLogin.toLowerCase() === profile.login.toLowerCase()
      ? 'github-author-login'
      : null;
  }
  const email = commit.author?.email.toLowerCase() ?? '';
  if (profile.email && email === profile.email.toLowerCase()) {
    return 'profile-email';
  }
  const noreply = new RegExp(
    `^(?:\\d+\\+)?${escapeRegExp(profile.login)}@users\\.noreply\\.github\\.com$`,
    'i',
  );
  return noreply.test(email) ? 'noreply-email' : null;
}

function commitDate(commit: GitHubCommitSummary): string {
  return commit.author?.date ?? commit.committer?.date ?? '';
}

function preferredBranch(branches: string[], defaultBranch: string): string {
  return branches.includes(defaultBranch)
    ? defaultBranch
    : (branches.sort()[0] ?? defaultBranch);
}

interface AddedHunk {
  startLine: number;
  content: string;
}

function addedHunks(patch: string): AddedHunk[] {
  const hunks: AddedHunk[] = [];
  let lineNumber = 0;
  let startLine = 0;
  let lines: string[] = [];
  const flush = () => {
    if (lines.length > 0) hunks.push({ startLine, content: lines.join('\n') });
    lines = [];
  };

  for (const line of patch.split('\n')) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (header) {
      flush();
      lineNumber = Number(header[1]);
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      if (lines.length === 0) startLine = lineNumber;
      lines.push(line.slice(1));
      lineNumber += 1;
    } else {
      flush();
      if (!line.startsWith('-') && !line.startsWith('\\')) lineNumber += 1;
    }
  }
  flush();
  return hunks;
}

function redactSuspectedSecrets(content: string): string {
  return content.replace(
    /(api[_-]?key|secret|token|password)(\s*[:=]\s*['"])[^'"\n]{8,}(['"])/gi,
    '$1$2[REDACTED]$3',
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferLanguages(paths: string[]): string[] {
  const names: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript',
    js: 'JavaScript',
    jsx: 'JavaScript',
    py: 'Python',
    go: 'Go',
    java: 'Java',
    rs: 'Rust',
    cs: 'C#',
    cpp: 'C++',
    cc: 'C++',
    c: 'C',
    kt: 'Kotlin',
    swift: 'Swift',
    rb: 'Ruby',
    scala: 'Scala',
    sql: 'SQL',
    r: 'R',
    tf: 'HCL',
    hcl: 'HCL',
    sh: 'Shell',
  };
  return [
    ...new Set(
      paths
        .map((path) => names[path.split('.').at(-1)?.toLowerCase() ?? ''])
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
