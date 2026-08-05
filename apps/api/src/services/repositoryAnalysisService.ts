import { analyzeRepositoryEvidence, type RepositoryFileEvidence } from '@proofly/analysis-core';
import type { CareerPath, RepositoryAnalysisResponse } from '@proofly/shared-types';
import { GitHubClient, type GitHubTreeItem } from '../github/githubClient.js';

const maxAnalyzedFiles = 18;
const maxFileSizeBytes = 45_000;
const maxTotalContentBytes = 180_000;

const excludedPathParts = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.next',
  '.turbo',
  '.venv',
  'venv',
  '__pycache__',
];

const excludedExtensions = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.lock',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.mp4',
  '.mov',
];

export async function analyzeRepositoryFromGitHub(
  client: GitHubClient,
  owner: string,
  repo: string,
  careerPath: CareerPath,
): Promise<RepositoryAnalysisResponse> {
  const repository = await client.getRepository(owner, repo);
  const tree = await client.getRepositoryTree(owner, repo, repository.defaultBranch);
  const candidateFiles = selectAnalysisFiles(tree);
  const files: RepositoryFileEvidence[] = [];
  let totalBytes = 0;

  for (const file of candidateFiles) {
    if (totalBytes >= maxTotalContentBytes) {
      break;
    }

    const content = await client.getRawFile(owner, repo, repository.defaultBranch, file.path);
    const sanitizedContent = redactSuspectedSecrets(content);
    totalBytes += sanitizedContent.length;
    files.push({
      path: file.path,
      size: file.size ?? sanitizedContent.length,
      content: sanitizedContent.slice(0, maxFileSizeBytes),
    });
  }

  return analyzeRepositoryEvidence({
    repository,
    careerPath,
    files,
    totalFiles: tree.filter((item) => item.type === 'blob').length,
  });
}

function selectAnalysisFiles(tree: GitHubTreeItem[]): GitHubTreeItem[] {
  return tree
    .filter((item) => item.type === 'blob')
    .filter((item) => item.size === undefined || item.size <= maxFileSizeBytes)
    .filter((item) => isSafeTextPath(item.path))
    .sort((a, b) => filePriority(a.path) - filePriority(b.path))
    .slice(0, maxAnalyzedFiles);
}

function isSafeTextPath(path: string): boolean {
  const lowerPath = path.toLowerCase();

  if (path.includes('..')) {
    return false;
  }

  if (excludedPathParts.some((part) => lowerPath.split('/').includes(part))) {
    return false;
  }

  if (excludedExtensions.some((extension) => lowerPath.endsWith(extension))) {
    return false;
  }

  return /\.(md|mdx|txt|ts|tsx|js|jsx|py|go|java|rs|cs|cpp|c|sql|json|yml|yaml|toml|ini|env\.example)$/.test(
    lowerPath,
  );
}

function filePriority(path: string): number {
  const lowerPath = path.toLowerCase();

  if (/^readme(\.|$)/.test(lowerPath)) {
    return 0;
  }

  if (isManifest(lowerPath)) {
    return 1;
  }

  if (lowerPath.startsWith('.github/workflows/')) {
    return 2;
  }

  if (lowerPath.includes('.env.example')) {
    return 3;
  }

  if (/(\.test\.|\.spec\.|\/tests?\/|\/__tests__\/)/.test(lowerPath)) {
    return 4;
  }

  if (lowerPath.startsWith('src/') || lowerPath.startsWith('app/')) {
    return 5;
  }

  return 9;
}

function isManifest(path: string): boolean {
  return [
    'package.json',
    'requirements.txt',
    'pyproject.toml',
    'pom.xml',
    'build.gradle',
    'cargo.toml',
    'go.mod',
  ].some((manifest) => path.endsWith(manifest));
}

function redactSuspectedSecrets(content: string): string {
  return content.replace(
    /(api[_-]?key|secret|token|password)(\s*[:=]\s*['"])[^'"\n]{8,}(['"])/gi,
    '$1$2[REDACTED]$3',
  );
}
