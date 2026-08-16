import {
  analyzeRepositoryEvidence,
  type RepositoryFileEvidence,
} from '@proofly/analysis-core';
import type {
  AnalysisProgressEvent,
  CareerPath,
  FileInspectionReport,
  GitHubRepository,
  InspectedFile,
  RepositoryAnalysisResponse,
} from '@proofly/shared-types';
import { GitHubClient, type GitHubTreeItem } from '../github/githubClient.js';

const maxAnalyzedFiles = 24;
const maxFileSizeBytes = 45_000;
const maxTotalContentBytes = 220_000;
/** Parallel raw-file downloads per repository. Raw content is served by a CDN rather than
 * the rate-limited REST API, so a modest amount of concurrency is safe. */
const downloadConcurrency = 6;
/** Ignored files listed individually in the response, so the payload stays small. */
const maxListedIgnoredFiles = 80;

const excludedDirectories = [
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.git',
  '.next',
  '.turbo',
  '.venv',
  'venv',
  '__pycache__',
  'vendor',
  'target',
];

const generatedFiles = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'poetry.lock',
  'cargo.lock',
  'go.sum',
  'composer.lock',
];

const textExtensionPattern =
  /\.(md|mdx|txt|rst|ts|tsx|js|jsx|mjs|cjs|py|ipynb|go|java|rs|cs|cpp|cc|c|h|hpp|kt|swift|rb|scala|sql|json|yml|yaml|toml|ini|cfg|tf|hcl|sh|r|example)$/;

interface ClassifiedFile {
  path: string;
  size: number | null;
  priority: number;
  /** Set when the file will not be downloaded. */
  skipReason: string | null;
  /** Set when the file is eligible, describing why it was chosen. */
  selectReason: string;
}

export interface AnalyzeRepositoryOptions {
  onProgress?: (event: AnalysisProgressEvent) => void;
  /**
   * Metadata already fetched by the caller. Supplying it skips a REST call, which matters
   * when a portfolio pass analyzes up to 100 repositories.
   */
  knownRepository?: GitHubRepository;
}

export async function analyzeRepositoryFromGitHub(
  client: GitHubClient,
  owner: string,
  repo: string,
  careerPath: CareerPath,
  options: AnalyzeRepositoryOptions = {},
): Promise<RepositoryAnalysisResponse> {
  const { onProgress, knownRepository } = options;
  const report = onProgress ?? (() => {});

  report({
    stage: 'fetching-repository',
    status: 'active',
    message: `FETCHING ${owner}/${repo} METADATA...`,
    stageProgress: 0,
  });

  const repository =
    knownRepository ?? (await client.getRepository(owner, repo));

  report({
    stage: 'fetching-repository',
    status: 'active',
    message: `METADATA OK · ${repository.language ?? 'UNKNOWN LANGUAGE'} · DEFAULT BRANCH ${repository.defaultBranch}`,
    stageProgress: 0.5,
  });
  report({
    stage: 'fetching-repository',
    status: 'active',
    message: 'FETCHING REPOSITORY TREE...',
    stageProgress: 0.5,
  });

  const tree = await client.getRepositoryTree(
    owner,
    repo,
    repository.defaultBranch,
  );
  const blobs = tree.filter((item) => item.type === 'blob');
  const classified = blobs.map(classifyFile);

  report({
    stage: 'fetching-repository',
    status: 'complete',
    message: `TREE OK · ${blobs.length} FILE(S) IN REPOSITORY`,
    stageProgress: 1,
  });

  const eligible = classified
    .filter((file) => file.skipReason === null)
    // Within a priority band prefer shallow files, then larger ones: a 30-line stub proves
    // much less than a substantial module.
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        depthOf(a.path) - depthOf(b.path) ||
        (b.size ?? 0) - (a.size ?? 0),
    );
  const { selected, overflow } = applyQuotas(eligible);

  report({
    stage: 'inspecting-code',
    status: 'active',
    message: `SELECTED ${selected.length} OF ${blobs.length} FILE(S) FOR INSPECTION`,
    counters: { filesSelected: selected.length },
    stageProgress: 0,
  });

  // Downloaded in parallel, then admitted in priority order so the byte budget stays
  // deterministic regardless of which response arrives first.
  let downloaded = 0;
  const downloads = await mapWithConcurrency(
    selected,
    downloadConcurrency,
    async (file) => {
      try {
        const content = await client.getRawFile(
          owner,
          repo,
          repository.defaultBranch,
          file.path,
        );
        downloaded += 1;
        // The only honest denominator in the whole analysis: files actually requested.
        report({
          stage: 'inspecting-code',
          status: 'active',
          message: `READ ${file.path}`,
          file: file.path,
          counters: {
            filesInspected: downloaded,
            filesSelected: selected.length,
          },
          stageProgress: downloaded / selected.length,
        });
        return {
          file,
          content: redactSuspectedSecrets(content).slice(0, maxFileSizeBytes),
        };
      } catch {
        downloaded += 1;
        report({
          stage: 'inspecting-code',
          status: 'active',
          message: `SKIPPED ${file.path} (UNREADABLE)`,
          counters: {
            filesInspected: downloaded,
            filesSelected: selected.length,
          },
          stageProgress: downloaded / selected.length,
        });
        return { file, content: null };
      }
    },
  );

  const files: RepositoryFileEvidence[] = [];
  const inspected: InspectedFile[] = [];
  const skippedForBudget: ClassifiedFile[] = [];
  const unreadable: ClassifiedFile[] = [];
  let totalBytes = 0;

  for (const { file, content } of downloads) {
    if (content === null) {
      unreadable.push(file);
      continue;
    }

    if (totalBytes >= maxTotalContentBytes) {
      skippedForBudget.push(file);
      continue;
    }

    totalBytes += content.length;
    files.push({ path: file.path, size: file.size ?? content.length, content });
    inspected.push({
      path: file.path,
      status: 'analyzed',
      reason: file.selectReason,
      sizeBytes: file.size,
    });
  }

  const ignored: InspectedFile[] = [
    ...classified
      .filter((file) => file.skipReason !== null)
      .map((file) => ({
        path: file.path,
        status: 'ignored' as const,
        reason: file.skipReason ?? 'Skipped.',
        sizeBytes: file.size,
      })),
    ...overflow.map((file) => ({
      path: file.path,
      status: 'ignored' as const,
      reason: `Outside the ${maxAnalyzedFiles}-file sampling budget: ${maxAnalyzedFiles} higher-priority files were read first.`,
      sizeBytes: file.size,
    })),
    ...skippedForBudget.map((file) => ({
      path: file.path,
      status: 'ignored' as const,
      reason: `The ${Math.round(maxTotalContentBytes / 1000)} KB content budget was reached before this file.`,
      sizeBytes: file.size,
    })),
    ...unreadable.map((file) => ({
      path: file.path,
      status: 'ignored' as const,
      reason: 'GitHub did not return readable contents for this path.',
      sizeBytes: file.size,
    })),
  ];

  const fileReport: FileInspectionReport = {
    totalFiles: blobs.length,
    analyzedCount: inspected.length,
    ignoredCount: ignored.length,
    files: [...inspected, ...ignored.slice(0, maxListedIgnoredFiles)],
    ignoredReasons: summarizeReasons(ignored),
    ignoredListTruncated: ignored.length > maxListedIgnoredFiles,
  };

  report({
    stage: 'inspecting-code',
    status: 'complete',
    message: `${files.length} FILE(S) READ · ${Math.round(totalBytes / 1000)} KB OF SOURCE INSPECTED`,
    counters: { filesInspected: files.length, filesSelected: selected.length },
    stageProgress: 1,
  });

  return analyzeRepositoryEvidence({
    repository,
    careerPath,
    files,
    totalFiles: blobs.length,
    treePaths: blobs.map((item) => item.path),
    fileReport,
    onProgress,
  });
}

/**
 * Caps how many files of each kind are read. Without this, a repository with 13 CI
 * workflows would spend the whole budget on YAML and never reach its source code.
 */
const quotaByPriority: Record<number, number> = {
  0: 1,
  1: 3,
  2: 3,
  3: 2,
  4: 5,
  7: 2,
  8: 3,
};

function applyQuotas(eligible: ClassifiedFile[]): {
  selected: ClassifiedFile[];
  overflow: ClassifiedFile[];
} {
  const selected: ClassifiedFile[] = [];
  const deferred: ClassifiedFile[] = [];
  const counts = new Map<number, number>();

  for (const file of eligible) {
    const quota = quotaByPriority[file.priority] ?? Number.POSITIVE_INFINITY;
    const used = counts.get(file.priority) ?? 0;

    if (used >= quota || selected.length >= maxAnalyzedFiles) {
      deferred.push(file);
      continue;
    }

    counts.set(file.priority, used + 1);
    selected.push(file);
  }

  // Spend any leftover budget on the highest-priority files the quotas held back.
  const overflow: ClassifiedFile[] = [];
  for (const file of deferred) {
    if (selected.length < maxAnalyzedFiles) {
      selected.push(file);
    } else {
      overflow.push(file);
    }
  }

  return { selected, overflow };
}

function classifyFile(item: GitHubTreeItem): ClassifiedFile {
  const path = item.path;
  const lowerPath = path.toLowerCase();
  const size = item.size ?? null;
  const base = { path, size };

  if (path.includes('..')) {
    return {
      ...base,
      priority: 99,
      skipReason: 'Unsafe path.',
      selectReason: '',
    };
  }

  const segments = lowerPath.split('/');
  const excludedDirectory = excludedDirectories.find((directory) =>
    segments.includes(directory),
  );
  if (excludedDirectory) {
    return {
      ...base,
      priority: 99,
      skipReason: `Inside ${excludedDirectory}/, which holds dependencies or build output rather than authored code.`,
      selectReason: '',
    };
  }

  if (generatedFiles.some((name) => segments.at(-1) === name)) {
    return {
      ...base,
      priority: 99,
      skipReason:
        'Generated lock file: it records resolved versions, not engineering decisions.',
      selectReason: '',
    };
  }

  if (
    !textExtensionPattern.test(lowerPath) &&
    !isExtensionlessTextFile(lowerPath)
  ) {
    return {
      ...base,
      priority: 99,
      skipReason: `Not a readable text or source file (${extensionOf(lowerPath)}).`,
      selectReason: '',
    };
  }

  if (size !== null && size > maxFileSizeBytes) {
    return {
      ...base,
      priority: 99,
      skipReason: `Larger than the ${Math.round(maxFileSizeBytes / 1000)} KB per-file limit (${Math.round(size / 1000)} KB).`,
      selectReason: '',
    };
  }

  const { priority, selectReason } = prioritize(lowerPath);
  return { ...base, priority, skipReason: null, selectReason };
}

function prioritize(lowerPath: string): {
  priority: number;
  selectReason: string;
} {
  const name = lowerPath.split('/').at(-1) ?? lowerPath;

  // Fixtures and examples are scaffolding for the real code, so they should not be the
  // evidence a repository is judged on while actual source is still unread.
  if (
    /(^|\/)(fixtures?|examples?|samples?|demos?|__mocks__)\//.test(lowerPath)
  ) {
    return { priority: 8, selectReason: 'Fixture or example file.' };
  }

  if (/^readme(\.|$)/.test(name)) {
    return lowerPath.includes('/')
      ? { priority: 7, selectReason: 'Secondary README in a subdirectory.' }
      : {
          priority: 0,
          selectReason: 'Root README: the primary project explanation.',
        };
  }

  if (isManifest(name)) {
    return {
      priority: 1,
      selectReason: 'Dependency manifest: declares the libraries in use.',
    };
  }

  if (
    lowerPath.startsWith('.github/workflows/') ||
    /\.gitlab-ci\.ya?ml$|jenkinsfile$/.test(lowerPath)
  ) {
    return {
      priority: 2,
      selectReason: 'CI configuration: shows which checks run automatically.',
    };
  }

  if (/\.env\.example$|\.env\.sample$/.test(lowerPath)) {
    return {
      priority: 3,
      selectReason:
        'Configuration example: documents required environment keys.',
    };
  }

  if (
    /(\.test\.|\.spec\.|(^|\/)tests?\/|(^|\/)__tests__\/|(^|\/)test_)/.test(
      lowerPath,
    )
  ) {
    return {
      priority: 4,
      selectReason: 'Test file: direct evidence that behaviour is verified.',
    };
  }

  if (/^(src|app|lib|pkg|cmd|internal|packages|apps)\//.test(lowerPath)) {
    return {
      priority: 5,
      selectReason: 'Source file in a main code directory.',
    };
  }

  // Not every project uses src/: Python packages and Go modules name the folder after the
  // project, so any source file still outranks generic supporting files.
  if (
    /\.(ts|tsx|js|jsx|mjs|cjs|py|ipynb|go|java|rs|cs|cpp|cc|c|kt|swift|rb|scala|r)$/.test(
      lowerPath,
    )
  ) {
    return { priority: 6, selectReason: 'Source file.' };
  }

  if (/\.(sql|tf|hcl)$|dockerfile/.test(lowerPath)) {
    return {
      priority: 6,
      selectReason: 'Infrastructure or schema definition.',
    };
  }

  if (/\.(md|mdx|rst)$/.test(lowerPath)) {
    return { priority: 7, selectReason: 'Project documentation.' };
  }

  return {
    priority: 8,
    selectReason:
      'Supporting file in the repository root or a secondary directory.',
  };
}

function summarizeReasons(
  files: InspectedFile[],
): { reason: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const file of files) {
    counts.set(file.reason, (counts.get(file.reason) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

function isExtensionlessTextFile(lowerPath: string): boolean {
  const name = lowerPath.split('/').at(-1) ?? lowerPath;
  return [
    'dockerfile',
    'makefile',
    'license',
    'gemfile',
    'jenkinsfile',
    'procfile',
  ].some((known) => name.startsWith(known));
}

function depthOf(path: string): number {
  return path.split('/').length;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index] as T);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function extensionOf(lowerPath: string): string {
  const name = lowerPath.split('/').at(-1) ?? lowerPath;
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(dotIndex) : 'no extension';
}

function isManifest(name: string): boolean {
  return [
    'package.json',
    'requirements.txt',
    'pyproject.toml',
    'pipfile',
    'pom.xml',
    'build.gradle',
    'cargo.toml',
    'go.mod',
    'gemfile',
    'composer.json',
  ].includes(name);
}

function redactSuspectedSecrets(content: string): string {
  return content.replace(
    /(api[_-]?key|secret|token|password)(\s*[:=]\s*['"])[^'"\n]{8,}(['"])/gi,
    '$1$2[REDACTED]$3',
  );
}
