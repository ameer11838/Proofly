import type {
  CareerPath,
  GitHubRepository,
  RepositoryAnalysisFinding,
  RepositoryAnalysisResponse,
} from '@proofly/shared-types';
import { careerCriteria } from './careerCriteria.js';

export interface RepositoryFileEvidence {
  path: string;
  size: number;
  content: string;
}

export interface RepositoryAnalysisInput {
  repository: GitHubRepository;
  careerPath: CareerPath;
  files: RepositoryFileEvidence[];
  totalFiles: number;
}

interface ScoredObservation {
  points: number;
  maxPoints: number;
  reason: string;
}

export function analyzeRepositoryEvidence({
  repository,
  careerPath,
  files,
  totalFiles,
}: RepositoryAnalysisInput): RepositoryAnalysisResponse {
  const findings: RepositoryAnalysisFinding[] = [];
  const observations: ScoredObservation[] = [];
  const paths = files.map((file) => file.path);
  const lowerPaths = paths.map((path) => path.toLowerCase());

  const readme = files.find((file) => /^readme(\.|$)/i.test(basename(file.path)));
  if (readme) {
    const readmeSignals = scoreReadme(readme.content);
    observations.push({
      points: readmeSignals.points,
      maxPoints: 2,
      reason: readmeSignals.reason,
    });
    findings.push({
      category: 'README and project explanation',
      importance: readmeSignals.points >= 1.4 ? 'Medium' : 'High',
      explanation: readmeSignals.explanation,
      evidence: [{ kind: 'file', label: 'README found', path: readme.path }],
      recommendation:
        readmeSignals.points >= 1.4
          ? 'Keep the README current as the project evolves.'
          : 'Add setup steps, usage examples, architecture notes, and screenshots or API examples.',
      careerRelevance: 'A clear README helps reviewers understand the problem, implementation, and tradeoffs quickly.',
    });
  } else {
    observations.push({ points: 0, maxPoints: 2, reason: 'No README was found.' });
    findings.push({
      category: 'README and project explanation',
      importance: 'High',
      explanation: 'No README was found in the selected repository evidence.',
      evidence: [{ kind: 'github', label: 'Repository tree did not include a README file' }],
      recommendation: 'Add a README with purpose, setup, usage, architecture, and next steps.',
      careerRelevance: 'Portfolio repositories need context so reviewers can evaluate the engineering work.',
    });
  }

  const testFiles = lowerPaths.filter(isTestPath);
  observations.push({
    points: testFiles.length > 0 ? 1.5 : 0,
    maxPoints: 1.5,
    reason:
      testFiles.length > 0
        ? `${testFiles.length} test-related file(s) were found.`
        : 'No test files were found.',
  });
  findings.push({
    category: 'Testing evidence',
    importance: testFiles.length > 0 ? 'Medium' : 'High',
    explanation:
      testFiles.length > 0
        ? 'The repository includes test-related files, which is useful evidence of validation practice.'
        : 'The analyzed file set did not include obvious tests.',
    evidence:
      testFiles.length > 0
        ? testFiles.slice(0, 4).map((path) => ({ kind: 'file', label: 'Test-related path', path }))
        : [{ kind: 'static-analysis', label: 'No test path matched common test patterns' }],
    recommendation:
      testFiles.length > 0
        ? 'Make sure tests are documented and cover important behavior, edge cases, and failure paths.'
        : 'Add automated tests and document how to run them.',
    careerRelevance:
      'Testing is a strong signal for production-minded engineering across software roles.',
  });

  const dependencyFiles = lowerPaths.filter(isDependencyPath);
  observations.push({
    points: dependencyFiles.length > 0 ? 1 : 0,
    maxPoints: 1,
    reason:
      dependencyFiles.length > 0
        ? 'Dependency manifests were found.'
        : 'No dependency manifest was found.',
  });

  const ciFiles = lowerPaths.filter((path) => path.startsWith('.github/workflows/'));
  observations.push({
    points: ciFiles.length > 0 ? 0.8 : 0,
    maxPoints: 0.8,
    reason: ciFiles.length > 0 ? 'CI workflow files were found.' : 'No CI workflow files were found.',
  });
  findings.push({
    category: 'CI/CD and automation',
    importance: ciFiles.length > 0 ? 'Low' : 'Medium',
    explanation:
      ciFiles.length > 0
        ? 'The repository includes GitHub Actions workflow files.'
        : 'The analyzed tree did not include GitHub Actions workflow files.',
    evidence:
      ciFiles.length > 0
        ? ciFiles.slice(0, 3).map((path) => ({ kind: 'file', label: 'Workflow file', path }))
        : [{ kind: 'static-analysis', label: 'No .github/workflows files found' }],
    recommendation:
      ciFiles.length > 0
        ? 'Ensure CI runs linting, type checking, tests, and build checks.'
        : 'Add CI for linting, tests, and builds so quality checks are visible.',
    careerRelevance: 'Automation shows that the project is maintained like a real engineering system.',
  });

  const envFiles = lowerPaths.filter((path) => path.includes('.env.example'));
  observations.push({
    points: envFiles.length > 0 ? 0.7 : 0,
    maxPoints: 0.7,
    reason:
      envFiles.length > 0
        ? 'Environment variable examples were found.'
        : 'No .env.example file was found.',
  });

  const sourceFiles = lowerPaths.filter(isSourcePath);
  observations.push({
    points: Math.min(sourceFiles.length / 8, 1.5),
    maxPoints: 1.5,
    reason:
      sourceFiles.length > 0
        ? `${sourceFiles.length} source file(s) were sampled.`
        : 'No source files were sampled.',
  });

  const careerPoints = scoreCareerSpecificEvidence(repository, careerPath, lowerPaths, files);
  observations.push(careerPoints);
  findings.push(buildCareerFinding(repository, careerPath, lowerPaths, careerPoints));

  addCodePatternFindings(files, careerPath, findings);

  const totalPoints = observations.reduce((sum, observation) => sum + observation.points, 0);
  const totalMax = observations.reduce((sum, observation) => sum + observation.maxPoints, 0);
  const score = Math.max(1, Math.min(10, Math.round((totalPoints / totalMax) * 10)));

  return {
    repository,
    careerPath,
    rating: {
      score,
      label: ratingLabel(score),
      summary: summarizeRating(repository, score),
      reasoning: observations.map((observation) => observation.reason),
    },
    findings,
    suggestions: findings
      .filter((finding) => finding.importance !== 'Low')
      .map((finding) => finding.recommendation)
      .slice(0, 6),
    analyzedFiles: paths,
    ignoredFilesCount: Math.max(0, totalFiles - files.length),
  };
}

function scoreReadme(content: string): {
  points: number;
  reason: string;
  explanation: string;
} {
  const lowerContent = content.toLowerCase();
  const signals = [
    lowerContent.includes('install') || lowerContent.includes('setup'),
    lowerContent.includes('usage') || lowerContent.includes('example'),
    lowerContent.includes('test') || lowerContent.includes('run'),
    lowerContent.includes('architecture') || lowerContent.includes('api'),
  ];
  const foundSignals = signals.filter(Boolean).length;
  const points = Math.min(2, 0.6 + foundSignals * 0.35);

  return {
    points,
    reason: `README found with ${foundSignals} completeness signal(s).`,
    explanation:
      foundSignals >= 3
        ? 'The README includes multiple useful project explanation signals.'
        : 'The README exists, but it may not fully explain setup, usage, testing, and architecture.',
  };
}

function scoreCareerSpecificEvidence(
  repository: GitHubRepository,
  careerPath: CareerPath,
  lowerPaths: string[],
  files: RepositoryFileEvidence[],
): ScoredObservation {
  const criteria = careerCriteria[careerPath];
  const text = [
    repository.name,
    repository.description ?? '',
    repository.language ?? '',
    ...repository.topics,
    ...lowerPaths,
    ...files.map((file) => file.content.slice(0, 1200)),
  ]
    .join(' ')
    .toLowerCase();

  const keywordMatches = [...criteria.keywords, ...criteria.topics].filter((keyword) =>
    text.includes(keyword.toLowerCase()),
  );

  const languageMatch =
    repository.language !== null && criteria.languages.includes(repository.language) ? 0.5 : 0;
  const keywordPoints = Math.min(keywordMatches.length * 0.2, 1);

  return {
    points: Math.min(1.5, languageMatch + keywordPoints),
    maxPoints: 1.5,
    reason:
      keywordMatches.length > 0
        ? `Career-specific evidence matched: ${keywordMatches.slice(0, 5).join(', ')}.`
        : 'No strong career-specific code or metadata signals were found.',
  };
}

function buildCareerFinding(
  repository: GitHubRepository,
  careerPath: CareerPath,
  lowerPaths: string[],
  observation: ScoredObservation,
): RepositoryAnalysisFinding {
  const matchedPaths = lowerPaths.filter((path) =>
    careerCriteria[careerPath].keywords.some((keyword) => path.includes(keyword.toLowerCase())),
  );

  return {
    category: 'Career-path relevance',
    importance: observation.points >= 1 ? 'Medium' : 'High',
    explanation: observation.reason,
    evidence: [
      {
        kind: 'github',
        label: `Primary language: ${repository.language ?? 'unknown'}`,
      },
      ...matchedPaths.slice(0, 3).map((path) => ({ kind: 'file' as const, label: 'Relevant path', path })),
    ],
    recommendation:
      observation.points >= 1
        ? 'Make the career-relevant technical decisions more explicit in the README and docs.'
        : 'Add role-specific evidence such as tests, architecture notes, API docs, experiments, pipelines, or deployment configuration.',
    careerRelevance: 'Proofly weights evidence differently depending on the selected target career.',
  };
}

function addCodePatternFindings(
  files: RepositoryFileEvidence[],
  careerPath: CareerPath,
  findings: RepositoryAnalysisFinding[],
): void {
  const todo = findFirst(files, /\b(TODO|FIXME)\b/i);
  if (todo) {
    findings.push({
      category: 'Code maintainability',
      importance: 'Low',
      explanation: 'A TODO/FIXME marker was found in sampled code.',
      evidence: [{ kind: 'file', label: 'Maintenance marker', path: todo.path, line: todo.line }],
      recommendation: 'Resolve stale TODOs or turn them into tracked issues with context.',
      careerRelevance: 'Visible maintenance markers are fine when intentional, but stale ones can weaken portfolio polish.',
    });
  }

  const consoleLog = findFirst(files, /\bconsole\.(log|debug)\s*\(/);
  if (consoleLog) {
    findings.push({
      category: 'Debugging and observability',
      importance: careerPath === 'backend-engineering' ? 'Medium' : 'Low',
      explanation: 'A console logging/debug statement was found in sampled code.',
      evidence: [
        { kind: 'file', label: 'Console logging statement', path: consoleLog.path, line: consoleLog.line },
      ],
      recommendation: 'Use structured logging or remove temporary debug logs before presenting the project.',
      careerRelevance: 'Logging practices matter especially for backend, full-stack, and DevOps-oriented work.',
    });
  }

  const possibleSecret = findFirst(files, /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}/i);
  if (possibleSecret) {
    findings.push({
      category: 'Security hygiene',
      importance: 'High',
      explanation:
        'A possible hardcoded secret pattern was detected. Proofly intentionally does not display the suspected value.',
      evidence: [
        { kind: 'file', label: 'Possible hardcoded secret pattern', path: possibleSecret.path, line: possibleSecret.line },
      ],
      recommendation:
        'Move secrets to environment variables, rotate any exposed credentials, and provide safe .env.example documentation.',
      careerRelevance: 'Security hygiene is important for every career path and especially backend, cloud, fintech, and cybersecurity roles.',
    });
  }
}

function ratingLabel(score: number): RepositoryAnalysisResponse['rating']['label'] {
  if (score >= 8) {
    return 'Excellent';
  }
  if (score >= 6) {
    return 'Strong';
  }
  if (score >= 4) {
    return 'Developing';
  }
  return 'Early';
}

function summarizeRating(repository: GitHubRepository, score: number): string {
  return `${repository.name} currently earns a ${score}/10 repository evidence rating based on sampled files, project structure, documentation, testing, automation, and career-specific signals.`;
}

function basename(path: string): string {
  return path.split('/').at(-1) ?? path;
}

function isTestPath(path: string): boolean {
  return /(^|\/)(__tests__|test|tests|spec)(\/|\.|-|_)/.test(path) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path);
}

function isDependencyPath(path: string): boolean {
  return [
    'package.json',
    'requirements.txt',
    'pyproject.toml',
    'pom.xml',
    'build.gradle',
    'cargo.toml',
    'go.mod',
  ].some((name) => path.endsWith(name));
}

function isSourcePath(path: string): boolean {
  return /\.(ts|tsx|js|jsx|py|go|java|rs|cs|cpp|c|sql|ipynb)$/.test(path);
}

function findFirst(
  files: RepositoryFileEvidence[],
  pattern: RegExp,
): { path: string; line: number } | null {
  for (const file of files) {
    const lines = file.content.split('\n');
    const index = lines.findIndex((line) => pattern.test(line));
    if (index >= 0) {
      return { path: file.path, line: index + 1 };
    }
  }

  return null;
}
