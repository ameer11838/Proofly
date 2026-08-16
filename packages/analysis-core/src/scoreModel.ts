import {
  scoreCategoryLabels,
  type CareerRelevanceReport,
  type CodeEvidence,
  type EvidenceReference,
  type GitHubRepository,
  type ImprovementAction,
  type ImprovementPlan,
  type ScoreBreakdown,
  type ScoreCategory,
  type ScoreCategoryKey,
  type ScoreSignal,
} from '@proofly/shared-types';
import type { RepositoryFileEvidence } from './codeEvidence.js';
import type { DependencyRecord } from './dependencies.js';

/**
 * Category weights, in points on the 0-10 Proofly scale. Actual implementation and
 * career fit deliberately dominate repository hygiene for portfolio-oriented scoring.
 */
export const categoryWeights: Record<ScoreCategoryKey, number> = {
  'technical-skills': 3,
  'career-relevance': 2.5,
  'creativity-complexity': 2,
  'project-quality': 1.5,
  presentation: 1,
};

export const maxScore = sumPoints(Object.values(categoryWeights));

const categoryDescriptions: Record<ScoreCategoryKey, string> = {
  'technical-skills':
    'How much meaningful technical implementation, breadth, and depth does the code demonstrate?',
  'career-relevance':
    'How strongly does the actual project evidence match the selected career?',
  'creativity-complexity':
    'Does the project solve a meaningful problem and combine enough moving parts to go beyond a basic tutorial?',
  'project-quality':
    'Is the work organized, maintainable, complete, and supported by reliability practices appropriate to its scope?',
  presentation:
    'Can a reviewer quickly understand the project, run it, and see what was built?',
};

export interface AnalysisContext {
  repository: GitHubRepository;
  /** Lowercase paths of every file in the repository tree. */
  allPaths: string[];
  /** Files whose contents Proofly downloaded. */
  files: RepositoryFileEvidence[];
  lowerPaths: string[];
  readme: RepositoryFileEvidence | null;
  workflowFiles: RepositoryFileEvidence[];
  dependencies: DependencyRecord[];
  codeEvidence: CodeEvidence[];
  relevance: CareerRelevanceReport;
}

interface BuiltSignal {
  signal: ScoreSignal;
  /** Present when the signal did not earn full points and there is a concrete fix. */
  improvement?: { title: string; detail: string };
}

/** Rounds to one decimal so every score value is a whole number of tenths. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Sums in tenths so category totals are exact rather than floating-point approximations. */
export function sumPoints(values: number[]): number {
  return (
    values.reduce((total, value) => total + Math.round(value * 10), 0) / 10
  );
}

function credit(max: number, fraction: number): number {
  return round1(max * Math.max(0, Math.min(1, fraction)));
}

export function buildScoreBreakdown(context: AnalysisContext): {
  breakdown: ScoreBreakdown;
  improvementPlan: ImprovementPlan;
} {
  const groups: { key: ScoreCategoryKey; signals: BuiltSignal[] }[] = [
    { key: 'technical-skills', signals: technicalSkillsSignals(context) },
    { key: 'career-relevance', signals: careerRelevanceSignals(context) },
    {
      key: 'creativity-complexity',
      signals: creativityComplexitySignals(context),
    },
    { key: 'project-quality', signals: projectQualitySignals(context) },
    { key: 'presentation', signals: presentationSignals(context) },
  ];

  const categories: ScoreCategory[] = groups.map(({ key, signals }) => ({
    key,
    label: scoreCategoryLabels[key],
    description: categoryDescriptions[key],
    earned: sumPoints(signals.map((entry) => entry.signal.earned)),
    max: categoryWeights[key],
    signals: signals.map((entry) => entry.signal),
  }));

  const score = sumPoints(categories.map((category) => category.earned));

  return {
    breakdown: { categories, score, maxScore },
    improvementPlan: buildImprovementPlan(groups, score),
  };
}

function buildImprovementPlan(
  groups: { key: ScoreCategoryKey; signals: BuiltSignal[] }[],
  score: number,
): ImprovementPlan {
  const actions: ImprovementAction[] = groups
    .flatMap(({ key, signals }) =>
      signals
        .filter((entry) => entry.improvement !== undefined)
        .map((entry) => ({
          id: `${key}-${entry.signal.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          title: entry.improvement?.title ?? '',
          detail: entry.improvement?.detail ?? '',
          category: key,
          points: round1(entry.signal.max - entry.signal.earned),
          paths: [
            ...new Set(
              entry.signal.evidence
                .map((reference) => reference.path)
                .filter((path): path is string => Boolean(path)),
            ),
          ],
          suggestedApproach: entry.improvement?.detail,
          quickWin: entry.signal.max - entry.signal.earned <= 0.2,
        })),
    )
    .filter((action) => action.points >= 0.1)
    .sort((a, b) => b.points - a.points)
    .slice(0, 6);

  return {
    currentScore: score,
    // Only the actions actually listed are promised, so this can never exceed the max.
    potentialScore: sumPoints([
      score,
      ...actions.map((action) => action.points),
    ]),
    maxScore,
    actions,
  };
}

// --- Technical skills --------------------------------------------------------------

function technicalSkillsSignals(context: AnalysisContext): BuiltSignal[] {
  const sourcePaths = context.allPaths
    .filter(isSourcePath)
    .filter((path) => !isTestPath(path));
  const sourceFiles = context.files.filter(
    (file) => isSourcePath(file.path.toLowerCase()) && !isTestPath(file.path),
  );
  const sourceLines = sourceFiles.reduce(
    (sum, file) => sum + file.content.split('\n').filter(Boolean).length,
    0,
  );
  const meaningfulFraction =
    0.45 * Math.min(1, sourcePaths.length / 3) +
    0.55 * Math.min(1, sourceLines / 220);
  const technologies = new Set([
    ...(context.repository.language ? [context.repository.language] : []),
    ...context.dependencies.map((dependency) => dependency.name),
  ]);
  const domains = detectTechnicalDomains(context.files);
  const implementationFraction = Math.min(
    1,
    domains.length / 3 + context.dependencies.length / 8,
  );
  const directories = new Set(
    sourcePaths
      .filter((path) => path.includes('/'))
      .map((path) => path.split('/').slice(0, -1).join('/')),
  );
  const depthFraction =
    0.35 * Math.min(1, directories.size / 3) +
    0.35 * Math.min(1, sourcePaths.length / 7) +
    0.3 * Math.min(1, domains.length / 3);

  return [
    {
      signal: {
        label: 'Meaningful code',
        max: 1.1,
        earned: credit(1.1, meaningfulFraction),
        detail:
          sourcePaths.length === 0
            ? 'No authored source files were found.'
            : `${sourcePaths.length} source file(s) and ${sourceLines} non-empty sampled source line(s) show the implementation behind the project.`,
        evidence: sourcePaths.slice(0, 4).map((path) => ({
          kind: 'file' as const,
          label: 'Source implementation',
          path,
        })),
      },
      improvement:
        meaningfulFraction >= 0.75
          ? undefined
          : {
              title: 'Build out the core implementation',
              detail:
                sourcePaths.length === 0
                  ? 'Add the source code that implements the project’s main behavior.'
                  : `The implementation is still small (${sourcePaths.length} source file(s)). Extend the core workflow with a meaningful feature or deeper technical behavior instead of adding repository ceremony.`,
            },
    },
    {
      signal: {
        label: 'Languages and frameworks',
        max: 0.7,
        earned: credit(0.7, technologies.size / 4),
        detail:
          technologies.size > 0
            ? `${technologies.size} language/framework/dependency signal(s) were observed, including ${[...technologies].slice(0, 5).join(', ')}.`
            : 'No language, framework, or parseable dependency evidence was found.',
        evidence: [
          ...(context.repository.language
            ? [
                {
                  kind: 'github' as const,
                  label: `Primary language: ${context.repository.language}`,
                },
              ]
            : []),
          ...context.dependencies.slice(0, 3).map((dependency) => ({
            kind: 'dependency' as const,
            label: dependency.name,
            path: dependency.path,
          })),
        ],
      },
    },
    {
      signal: {
        label: 'Technical implementation breadth',
        max: 0.7,
        earned: credit(0.7, implementationFraction),
        detail:
          domains.length + context.dependencies.length > 0
            ? `The code and manifests demonstrate ${domains.slice(0, 6).join(', ') || `${context.dependencies.length} declared technical dependencies`}.`
            : 'No API, database, algorithmic, AI/ML, asynchronous, or career-specific implementation signal was found in sampled code.',
        evidence: context.dependencies.slice(0, 4).map((dependency) => ({
          kind: 'dependency' as const,
          label: dependency.name,
          path: dependency.path,
        })),
      },
      improvement:
        implementationFraction >= 0.7
          ? undefined
          : {
              title: 'Add a deeper technical feature',
              detail:
                'Extend the project with a substantive API, data workflow, algorithm, model, integration, or other implementation that demonstrates technical decisions in code.',
            },
    },
    {
      signal: {
        label: 'Technical depth',
        max: 0.5,
        earned: credit(0.5, depthFraction),
        detail: `${directories.size} source module director${directories.size === 1 ? 'y' : 'ies'}, ${sourcePaths.length} source file(s), and ${domains.length} implemented technical domain(s) contribute to depth.`,
        evidence: sourcePaths.slice(0, 2).map((path) => ({
          kind: 'file' as const,
          label: 'Technical depth',
          path,
        })),
      },
    },
  ];
}

// --- Creativity and complexity -----------------------------------------------------

function creativityComplexitySignals(context: AnalysisContext): BuiltSignal[] {
  const sourcePaths = context.allPaths
    .filter(isSourcePath)
    .filter((path) => !isTestPath(path));
  const sourceLines = context.files
    .filter(
      (file) => isSourcePath(file.path.toLowerCase()) && !isTestPath(file.path),
    )
    .reduce(
      (sum, file) => sum + file.content.split('\n').filter(Boolean).length,
      0,
    );
  const domains = detectTechnicalDomains(context.files);
  const directories = new Set(
    sourcePaths
      .filter((path) => path.includes('/'))
      .map((path) => path.split('/').slice(0, -1).join('/')),
  );
  const challengeEvidence = context.codeEvidence.filter((evidence) =>
    ['error-handling', 'input-validation'].includes(evidence.skillId),
  );
  const scopeFraction =
    0.5 * Math.min(1, sourcePaths.length / 6) +
    0.5 * Math.min(1, sourceLines / 400);
  const integrationFraction = Math.min(
    1,
    context.dependencies.length / 6 + directories.size / 4 + domains.length / 4,
  );
  const challengeFraction = Math.min(
    1,
    domains.length / 4 + challengeEvidence.length / 3 + sourceLines / 900,
  );
  const readmeText = context.readme?.content.toLowerCase() ?? '';
  const hasProblemFraming =
    (context.repository.description?.trim().length ?? 0) >= 30 ||
    /\b(problem|challenge|goal|objective|motivation|built to|helps? users?)\b/.test(
      readmeText,
    );
  const hasDistinctiveScope =
    context.repository.topics.length >= 2 || domains.length >= 2;

  return [
    {
      signal: {
        label: 'Project scope',
        max: 0.6,
        earned: credit(0.6, scopeFraction),
        detail:
          sourcePaths.length > 0
            ? `${sourcePaths.length} production source file(s) and ${sourceLines} sampled source line(s) indicate the amount of implemented scope.`
            : 'No production source scope was found.',
        evidence: sourcePaths.slice(0, 4).map((path) => ({
          kind: 'file' as const,
          label: 'Implemented project scope',
          path,
        })),
      },
    },
    {
      signal: {
        label: 'Multiple technologies working together',
        max: 0.5,
        earned: credit(0.5, integrationFraction),
        detail: `${context.dependencies.length} dependencies, ${directories.size} module directories, and ${domains.length} technical domain(s) provide observable integration evidence.`,
        evidence: context.dependencies.slice(0, 4).map((dependency) => ({
          kind: 'dependency' as const,
          label: dependency.name,
          path: dependency.path,
        })),
      },
      improvement:
        integrationFraction >= 0.7
          ? undefined
          : {
              title: 'Connect another meaningful system component',
              detail:
                'Add an integration that serves the project’s goal—for example persistence, an external API, data processing, or a distinct frontend/backend boundary.',
            },
    },
    {
      signal: {
        label: 'Interesting technical challenges',
        max: 0.6,
        earned: credit(0.6, challengeFraction),
        detail:
          domains.length + challengeEvidence.length > 0
            ? `${domains.length} technical domain and ${challengeEvidence.length} defensive implementation signal(s) show non-trivial technical decisions.`
            : 'The sampled code does not yet expose a non-trivial algorithm, integration, data flow, model, or defensive implementation challenge.',
        evidence: challengeEvidence.slice(0, 4).map((evidence) => ({
          kind: 'file' as const,
          label: evidence.detected,
          path: evidence.path,
          line: evidence.startLine,
        })),
      },
    },
    {
      signal: {
        label: 'Original problem framing',
        max: 0.3,
        earned: credit(
          0.3,
          (hasProblemFraming ? 0.6 : 0) + (hasDistinctiveScope ? 0.4 : 0),
        ),
        detail:
          hasProblemFraming || hasDistinctiveScope
            ? 'The description, README, topics, or technical scope communicate a specific problem beyond a bare code exercise.'
            : 'No specific problem, motivation, distinctive scope, or real-world use is explained yet.',
        evidence: [
          ...(context.repository.description
            ? [{ kind: 'github' as const, label: 'Repository description' }]
            : []),
          ...(context.readme
            ? [
                {
                  kind: 'file' as const,
                  label: 'README problem framing',
                  path: context.readme.path,
                },
              ]
            : []),
        ],
      },
      improvement: hasProblemFraming
        ? undefined
        : {
            title:
              'Explain the problem and what makes the solution interesting',
            detail:
              'Add a short README section describing who the project helps, the problem it solves, and the hardest technical decision you made.',
          },
    },
  ];
}

// --- Project quality ---------------------------------------------------------------

function projectQualitySignals(context: AnalysisContext): BuiltSignal[] {
  const tests = testingSignals(context);
  const automation = ciSignals(context);
  const structure = codeStructureSignals(context);
  const completeness = completenessSignals(context);
  const hasTests = context.allPaths.some(isTestPath);
  const hasAutomation =
    context.workflowFiles.length > 0 ||
    context.allPaths.some((path) =>
      /^\.github\/workflows\/|\.gitlab-ci\.ya?ml$|jenkinsfile$/.test(path),
    );

  return [
    summarizeSignalGroup(
      'Code organization and maintainability',
      structure,
      0.4,
    ),
    summarizeSignalGroup('Completeness and reproducibility', completeness, 0.3),
    summarizeSignalGroup('Testing', tests, 0.4),
    summarizeSignalGroup('CI/CD and automation', automation, 0.2),
    {
      signal: {
        label: 'Exceptional-quality safeguards',
        max: 0.2,
        earned: hasTests && hasAutomation ? 0.2 : 0,
        detail:
          hasTests && hasAutomation
            ? 'Both automated tests and an automation pipeline are present—evidence expected of exceptionally polished work.'
            : 'Tests and CI/CD are treated as polish signals: their absence does not erase the project’s technical value, but prevents full Project Quality credit.',
        evidence: [
          ...(hasTests
            ? [
                {
                  kind: 'static-analysis' as const,
                  label: 'Automated tests detected',
                },
              ]
            : []),
          ...(hasAutomation
            ? [
                {
                  kind: 'static-analysis' as const,
                  label: 'Automation pipeline detected',
                },
              ]
            : []),
        ],
      },
    },
  ];
}

function summarizeSignalGroup(
  label: string,
  entries: BuiltSignal[],
  max: number,
): BuiltSignal {
  const originalMax = entries.reduce((sum, entry) => sum + entry.signal.max, 0);
  const originalEarned = entries.reduce(
    (sum, entry) => sum + entry.signal.earned,
    0,
  );
  const met = entries.filter(
    (entry) => entry.signal.earned >= entry.signal.max,
  );
  const strongestImprovement = entries
    .filter((entry) => entry.improvement)
    .sort(
      (a, b) =>
        b.signal.max - b.signal.earned - (a.signal.max - a.signal.earned),
    )[0]?.improvement;
  return {
    signal: {
      label,
      max,
      earned: credit(max, originalMax > 0 ? originalEarned / originalMax : 0),
      detail: `${met.length} of ${entries.length} supporting checks passed: ${
        met.map((entry) => entry.signal.label.toLowerCase()).join(', ') ||
        'none'
      }.`,
      evidence: entries.flatMap((entry) => entry.signal.evidence).slice(0, 5),
    },
    improvement: strongestImprovement,
  };
}

// --- Presentation ------------------------------------------------------------------

function presentationSignals(context: AnalysisContext): BuiltSignal[] {
  const documentation = reweightSignals(documentationSignals(context), 0.9);
  const hasDescription =
    (context.repository.description?.trim().length ?? 0) > 0;
  return [
    ...documentation,
    {
      signal: {
        label: 'Project description',
        max: 0.1,
        earned: hasDescription ? 0.1 : 0,
        detail: hasDescription
          ? 'The GitHub repository has a concise project description.'
          : 'The GitHub repository has no project description.',
        evidence: hasDescription
          ? [{ kind: 'github', label: 'Repository description' }]
          : [],
      },
      improvement: hasDescription
        ? undefined
        : {
            title: 'Add a concise project description',
            detail:
              'Summarize the problem and solution in one sentence so a reviewer understands the project before opening the README.',
          },
    },
  ];
}

function reweightSignals(
  signals: BuiltSignal[],
  targetMax: number,
): BuiltSignal[] {
  const originalMax = signals.reduce((sum, entry) => sum + entry.signal.max, 0);
  let allocated = 0;
  return signals.map((entry, index) => {
    const isLast = index === signals.length - 1;
    const max = isLast
      ? round1(targetMax - allocated)
      : round1(targetMax * (entry.signal.max / originalMax));
    allocated = round1(allocated + max);
    return {
      ...entry,
      signal: {
        ...entry.signal,
        max,
        earned: credit(
          max,
          entry.signal.max > 0 ? entry.signal.earned / entry.signal.max : 0,
        ),
      },
    };
  });
}

function detectTechnicalDomains(files: RepositoryFileEvidence[]): string[] {
  const source = files.map((file) => file.content).join('\n');
  const domains = [
    {
      label: 'API integration',
      pattern:
        /\b(fetch\s*\(|axios\.|app\.(?:get|post|put|delete)\s*\(|router\.(?:get|post|put|delete)\s*\()/i,
    },
    {
      label: 'database or persistence',
      pattern:
        /\b(SELECT|INSERT|UPDATE|DELETE)\b|\b(?:query|transaction|repository|prisma|mongoose)\s*[.(]/i,
    },
    {
      label: 'algorithmic processing',
      pattern:
        /\b(?:sort|reduce|graph|tree|dynamic programming|binary search|optimi[sz]|backtest)\b/i,
    },
    {
      label: 'AI or machine learning',
      pattern:
        /\b(?:model\.(?:fit|predict)|train_test_split|tensorflow|pytorch|sklearn|embedding|neural|llm)\b/i,
    },
    {
      label: 'asynchronous workflow',
      pattern: /\b(?:async|await|Promise\.all|queue|worker|stream)\b/i,
    },
    {
      label: 'data transformation',
      pattern:
        /\b(?:groupby|dataframe|map\s*\(|filter\s*\(|aggregate|pipeline)\b/i,
    },
  ];
  return domains
    .filter((domain) => domain.pattern.test(source))
    .map((domain) => domain.label);
}

// --- Documentation -----------------------------------------------------------------

function documentationSignals(context: AnalysisContext): BuiltSignal[] {
  const { readme } = context;
  const content = readme?.content ?? '';
  const lower = content.toLowerCase();
  const readmeRef: EvidenceReference[] = readme
    ? [{ kind: 'file', label: 'README', path: readme.path }]
    : [
        {
          kind: 'static-analysis',
          label: 'No README file in the repository tree',
        },
      ];

  const hasSetup =
    /\b(install|installation|setup|getting started|prerequisite|requirements)\b/.test(
      lower,
    );
  const hasUsage =
    /\b(usage|example|quick ?start|how to (?:use|run))\b/.test(lower) ||
    /```/.test(content);
  const hasArchitecture =
    /\b(architecture|design|how it works|project structure|folder structure|api reference|endpoints?)\b/.test(
      lower,
    ) || context.allPaths.some((path) => path.startsWith('docs/'));
  const hasVisuals =
    /!\[[^\]]*\]\([^)]+\)/.test(content) ||
    /\b(screenshot|demo|live site|deployed at)\b/.test(lower) ||
    context.repository.homepage !== null;

  return [
    {
      signal: {
        label: 'README present',
        max: 0.6,
        earned: readme ? 0.6 : 0,
        detail: readme
          ? `${readme.path} was found and read (${content.split('\n').length} lines).`
          : 'No README file was found anywhere in the repository tree.',
        evidence: readmeRef,
      },
      improvement: readme
        ? undefined
        : {
            title: 'Add a README',
            detail: `${context.repository.name} has no README, so a reviewer opening the repository sees only a file list. Add one covering the problem it solves, setup, usage, and architecture.`,
          },
    },
    {
      signal: {
        label: 'Setup instructions',
        max: 0.4,
        earned: hasSetup ? 0.4 : 0,
        detail: hasSetup
          ? 'The README explains installation or prerequisites.'
          : 'No installation, setup, or prerequisites section was found in the README.',
        evidence: readmeRef,
      },
      improvement: hasSetup
        ? undefined
        : {
            title: 'Document how to run the project',
            detail: readme
              ? `${readme.path} does not describe installation or prerequisites. Add the exact commands needed to install dependencies and start ${context.repository.name} locally.`
              : 'Add setup and prerequisite instructions once a README exists.',
          },
    },
    {
      signal: {
        label: 'Usage examples',
        max: 0.4,
        earned: hasUsage ? 0.4 : 0,
        detail: hasUsage
          ? 'The README shows usage, examples, or runnable commands.'
          : 'No usage section or example code block was found in the README.',
        evidence: readmeRef,
      },
      improvement: hasUsage
        ? undefined
        : {
            title: 'Show a concrete usage example',
            detail: `Add a fenced code block to ${readme?.path ?? 'the README'} showing a real invocation and its output, so a reviewer can see what ${context.repository.name} does without cloning it.`,
          },
    },
    {
      signal: {
        label: 'Architecture notes',
        max: 0.3,
        earned: hasArchitecture ? 0.3 : 0,
        detail: hasArchitecture
          ? 'Architecture, structure, or API reference material was found.'
          : 'Neither the README nor a docs/ directory explains how the project is put together.',
        evidence: readmeRef,
      },
      improvement: hasArchitecture
        ? undefined
        : {
            title: 'Explain the architecture',
            detail: describeArchitectureGap(context),
          },
    },
    {
      signal: {
        label: 'Screenshots or demo',
        max: 0.3,
        earned: hasVisuals ? 0.3 : 0,
        detail: hasVisuals
          ? 'The project links a demo, homepage, or embedded image.'
          : 'No embedded images, screenshots, or deployed URL were found.',
        evidence: readmeRef,
      },
      improvement: hasVisuals
        ? undefined
        : {
            title: 'Add a screenshot or demo link',
            detail:
              'Embed a screenshot, GIF, or deployed URL in the README. Reviewers spend seconds per repository, and a visual is the fastest way to show the project works.',
          },
    },
  ];
}

function describeArchitectureGap(context: AnalysisContext): string {
  const directories = topSourceDirectories(context.allPaths, 3);

  if (directories.length === 0) {
    return 'Add a short architecture section describing the main components and how data flows between them.';
  }

  return `The repository is organised into ${directories.join(', ')}, but nothing explains what those parts do. Add an architecture section mapping each directory to its responsibility.`;
}

// --- Testing -----------------------------------------------------------------------

function testingSignals(context: AnalysisContext): BuiltSignal[] {
  const testPaths = context.allPaths.filter(isTestPath);
  const sourcePaths = context.allPaths
    .filter(isSourcePath)
    .filter((path) => !isTestPath(path));
  const frameworks = testFrameworks(context.dependencies);
  const ratio =
    sourcePaths.length > 0 ? testPaths.length / sourcePaths.length : 0;
  const breadthFraction = Math.min(1, ratio / 0.25);
  const untested = untestedSourceFiles(context, testPaths, sourcePaths);

  return [
    {
      signal: {
        label: 'Tests exist',
        max: 0.8,
        earned: testPaths.length > 0 ? 0.8 : 0,
        detail:
          testPaths.length > 0
            ? `${testPaths.length} test file(s) in the repository tree, including ${testPaths.slice(0, 2).join(', ')}.`
            : 'No file in the repository tree matches a common test naming pattern.',
        evidence:
          testPaths.length > 0
            ? testPaths.slice(0, 3).map((path) => ({
                kind: 'file' as const,
                label: 'Test file',
                path,
              }))
            : [
                {
                  kind: 'static-analysis',
                  label:
                    'No test files matched *.test.*, *.spec.*, test_*.py, or tests/',
                },
              ],
      },
      improvement:
        testPaths.length > 0
          ? undefined
          : {
              title: 'Add automated tests',
              detail: describeMissingTests(context, untested),
            },
    },
    {
      signal: {
        label: 'Test framework declared',
        max: 0.4,
        earned: frameworks.length > 0 ? 0.4 : 0,
        detail:
          frameworks.length > 0
            ? `${frameworks.map((record) => record.name).join(', ')} declared in ${frameworks[0]?.path}.`
            : 'No test framework was found in the dependency manifests Proofly read.',
        evidence: frameworks.slice(0, 2).map((record) => ({
          kind: 'dependency' as const,
          label: `${record.name} test framework`,
          path: record.path,
        })),
      },
      improvement:
        frameworks.length > 0
          ? undefined
          : {
              title: 'Declare a test runner',
              detail:
                'Add a test framework to the dependency manifest and a `test` script, so anyone can run the suite with a single command.',
            },
    },
    {
      signal: {
        label: 'Test coverage breadth',
        max: 0.6,
        earned: credit(0.6, breadthFraction),
        detail:
          sourcePaths.length === 0
            ? 'No source files were found to compare against.'
            : `${testPaths.length} test file(s) for ${sourcePaths.length} source file(s) (${Math.round(ratio * 100)}%). Full credit at 25%.`,
        evidence: [
          {
            kind: 'static-analysis',
            label: `${testPaths.length} test files / ${sourcePaths.length} source files`,
          },
        ],
      },
      improvement:
        breadthFraction >= 1
          ? undefined
          : {
              title: 'Cover more of the codebase',
              detail: describeMissingTests(context, untested),
            },
    },
  ];
}

function describeMissingTests(
  context: AnalysisContext,
  untested: string[],
): string {
  if (untested.length === 0) {
    return `Add unit tests for the core logic in ${context.repository.name} and document how to run them.`;
  }

  const [first, ...rest] = untested;
  const others =
    rest.length > 0 ? ` (also ${rest.slice(0, 2).join(', ')})` : '';

  return `The repository contains substantial logic in ${first}${others}, but no matching test file was detected. Add unit tests covering the behaviour in ${first}, including its edge cases and failure paths.`;
}

/** Source files with no sibling test file, largest first. */
function untestedSourceFiles(
  context: AnalysisContext,
  testPaths: string[],
  sourcePaths: string[],
): string[] {
  const testedStems = new Set(
    testPaths.map((path) =>
      basename(path)
        .replace(/\.(test|spec)\./, '.')
        .replace(/^test_/, '')
        .replace(/\.[^.]+$/, '')
        .toLowerCase(),
    ),
  );

  const sizeByPath = new Map(
    context.files.map((file) => [file.path.toLowerCase(), file.content.length]),
  );

  return sourcePaths
    .filter((path) => !isConfigPath(path))
    .filter((path) => {
      const stem = basename(path)
        .replace(/\.[^.]+$/, '')
        .toLowerCase();
      return !testedStems.has(stem);
    })
    .sort((a, b) => (sizeByPath.get(b) ?? 0) - (sizeByPath.get(a) ?? 0))
    .slice(0, 4);
}

function testFrameworks(dependencies: DependencyRecord[]): DependencyRecord[] {
  const known = [
    'jest',
    'vitest',
    'mocha',
    'pytest',
    'junit',
    'testify',
    'rspec',
    'playwright',
    'cypress',
  ];
  return dependencies.filter((record) =>
    known.some((name) => record.name.includes(name)),
  );
}

// --- CI / automation ---------------------------------------------------------------

function ciSignals(context: AnalysisContext): BuiltSignal[] {
  const workflowPaths = context.allPaths.filter(
    (path) =>
      path.startsWith('.github/workflows/') ||
      /\.gitlab-ci\.ya?ml$|jenkinsfile$/.test(path),
  );
  const workflowContent = context.workflowFiles
    .map((file) => file.content)
    .join('\n')
    .toLowerCase();
  const runsTests =
    /\b(test|pytest|vitest|jest|go test|gradle test|mvn test)\b/.test(
      workflowContent,
    );
  const runsChecks =
    /\b(lint|eslint|ruff|flake8|typecheck|tsc|build|mypy|fmt)\b/.test(
      workflowContent,
    );

  return [
    {
      signal: {
        label: 'Pipeline configured',
        max: 0.6,
        earned: workflowPaths.length > 0 ? 0.6 : 0,
        detail:
          workflowPaths.length > 0
            ? `${workflowPaths.length} workflow file(s): ${workflowPaths.slice(0, 2).join(', ')}.`
            : 'No .github/workflows, GitLab CI, or Jenkins configuration is present in the tree.',
        evidence:
          workflowPaths.length > 0
            ? workflowPaths.slice(0, 3).map((path) => ({
                kind: 'file' as const,
                label: 'Workflow',
                path,
              }))
            : [
                {
                  kind: 'static-analysis',
                  label: 'No CI configuration found in the repository tree',
                },
              ],
      },
      improvement:
        workflowPaths.length > 0
          ? undefined
          : {
              title: 'Add GitHub Actions CI',
              detail: `Add .github/workflows/ci.yml that installs dependencies and runs the checks for ${context.repository.name} on push and pull request. CI output is public proof that the project builds.`,
            },
    },
    {
      signal: {
        label: 'Tests run in CI',
        max: 0.4,
        earned: runsTests ? 0.4 : 0,
        detail: runsTests
          ? 'A workflow step runs the test suite.'
          : workflowPaths.length > 0
            ? 'Workflow files were read, but no step runs a test command.'
            : 'No pipeline exists to run tests.',
        evidence: context.workflowFiles.slice(0, 2).map((file) => ({
          kind: 'file' as const,
          label: 'Workflow definition',
          path: file.path,
        })),
      },
      improvement: runsTests
        ? undefined
        : {
            title: 'Run the test suite in CI',
            detail:
              workflowPaths.length > 0
                ? `The existing workflow does not execute tests. Add a step that runs the suite so regressions fail the build.`
                : 'Once CI exists, make running the tests one of its steps.',
          },
    },
    {
      signal: {
        label: 'Lint, types, or build in CI',
        max: 0.2,
        earned: runsChecks ? 0.2 : 0,
        detail: runsChecks
          ? 'A workflow step runs linting, type checking, or a build.'
          : 'No linting, type checking, or build step was found in CI.',
        evidence: context.workflowFiles.slice(0, 1).map((file) => ({
          kind: 'file' as const,
          label: 'Workflow definition',
          path: file.path,
        })),
      },
      improvement: runsChecks
        ? undefined
        : {
            title: 'Add static checks to CI',
            detail:
              'Add lint, type-check, or build steps to the pipeline so style and type errors are caught automatically.',
          },
    },
  ];
}

// --- Code structure ----------------------------------------------------------------

function codeStructureSignals(context: AnalysisContext): BuiltSignal[] {
  const sourcePaths = context.allPaths.filter(isSourcePath);
  // Any directory counts, not just src/: Python packages, Go modules, and Rails apps all
  // organise code under a project-named folder.
  const rootLevel = sourcePaths.filter((path) => !path.includes('/'));
  const organized = sourcePaths.filter((path) => path.includes('/'));
  const organizationFraction =
    sourcePaths.length > 0 ? organized.length / sourcePaths.length : 0;

  const directories = new Set(
    sourcePaths
      .filter((path) => path.includes('/'))
      .map((path) => path.split('/').slice(0, -1).join('/')),
  );
  const breadthFraction = Math.min(1, directories.size / 4);

  const errorHandling = context.codeEvidence.filter(
    (evidence) => evidence.skillId === 'error-handling',
  );
  const validation = context.codeEvidence.filter(
    (evidence) => evidence.skillId === 'input-validation',
  );
  const typedLanguage = [
    'TypeScript',
    'Rust',
    'Go',
    'Java',
    'C#',
    'Kotlin',
    'Swift',
  ].includes(context.repository.language ?? '');

  const longestFile = [...context.files]
    .filter((file) => isSourcePath(file.path.toLowerCase()))
    .sort(
      (a, b) => b.content.split('\n').length - a.content.split('\n').length,
    )[0];
  const longestLines = longestFile ? longestFile.content.split('\n').length : 0;
  const sizeFraction =
    longestLines === 0
      ? 1
      : Math.min(1, Math.max(0, (1000 - longestLines) / 600));

  return [
    {
      signal: {
        label: 'Directory organisation',
        max: 0.5,
        earned: credit(0.5, organizationFraction),
        detail:
          sourcePaths.length === 0
            ? 'No source files were found in the repository tree.'
            : `${organized.length} of ${sourcePaths.length} source files live inside a directory rather than at the repository root.`,
        evidence: [
          {
            kind: 'static-analysis',
            label: `${directories.size} source directories in the tree`,
          },
        ],
      },
      improvement:
        organizationFraction >= 1
          ? undefined
          : {
              title: 'Group source files into directories',
              detail: `${rootLevel.length} source file(s) sit loose at the repository root (${rootLevel.slice(0, 3).join(', ')}). Move them into a package or src/ directory so the entry points are obvious.`,
            },
    },
    {
      signal: {
        label: 'Module separation',
        max: 0.4,
        earned: credit(0.4, breadthFraction),
        detail: `Source code is split across ${directories.size} directory/directories. Full credit at 4.`,
        evidence: [
          {
            kind: 'static-analysis',
            label:
              topSourceDirectories(context.allPaths, 4).join(', ') ||
              'No nested source directories',
          },
        ],
      },
      improvement:
        breadthFraction >= 1
          ? undefined
          : {
              title: 'Separate concerns into modules',
              detail:
                'The code sits in very few directories. Split distinct responsibilities (for example API access, business logic, and UI) into their own modules so the structure communicates the design.',
            },
    },
    {
      signal: {
        label: 'Error handling',
        max: 0.4,
        earned: errorHandling.length > 0 ? 0.4 : 0,
        detail:
          errorHandling.length > 0
            ? `Explicit failure handling found in ${errorHandling[0]?.path}:${errorHandling[0]?.startLine}.`
            : 'No try/catch, except, or error-return handling was found in the sampled source files.',
        evidence: errorHandling.slice(0, 2).map((evidence) => ({
          kind: 'file' as const,
          label: evidence.detected,
          path: evidence.path,
          line: evidence.startLine,
        })),
      },
      improvement:
        errorHandling.length > 0
          ? undefined
          : {
              title: 'Handle failure paths explicitly',
              detail:
                'The sampled code has no visible error handling. Wrap I/O and network calls so failures produce a clear message instead of an unhandled exception.',
            },
    },
    {
      signal: {
        label: 'Typed or validated boundaries',
        max: 0.3,
        earned: validation.length > 0 || typedLanguage ? 0.3 : 0,
        detail:
          validation.length > 0
            ? `Schema validation found in ${validation[0]?.path}:${validation[0]?.startLine}.`
            : typedLanguage
              ? `${context.repository.language} provides compile-time type checking at module boundaries.`
              : 'No schema validation or statically typed language was detected.',
        evidence: validation.slice(0, 1).map((evidence) => ({
          kind: 'file' as const,
          label: evidence.detected,
          path: evidence.path,
          line: evidence.startLine,
        })),
      },
      improvement:
        validation.length > 0 || typedLanguage
          ? undefined
          : {
              title: 'Validate inputs at the boundary',
              detail:
                'Add schema validation (or type annotations) where external input enters the system, so bad data fails fast with a useful message.',
            },
    },
    {
      signal: {
        label: 'File size discipline',
        max: 0.2,
        earned: credit(0.2, sizeFraction),
        detail: longestFile
          ? `Largest sampled source file is ${longestFile.path} at ${longestLines} lines. Full credit below 400.`
          : 'No source files were sampled.',
        evidence: longestFile
          ? [
              {
                kind: 'file',
                label: `${longestLines} lines`,
                path: longestFile.path,
              },
            ]
          : [],
      },
      improvement:
        sizeFraction >= 1 || !longestFile
          ? undefined
          : {
              title: `Split ${longestFile.path}`,
              detail: `${longestFile.path} is ${longestLines} lines. Break it into focused modules so reviewers can follow one responsibility at a time.`,
            },
    },
  ];
}

// --- Career relevance --------------------------------------------------------------

function careerRelevanceSignals(context: AnalysisContext): BuiltSignal[] {
  const { relevance } = context;
  const max = categoryWeights['career-relevance'];
  const strong = relevance.skills.filter(
    (skill) => skill.strength === 'strong',
  );
  const moderate = relevance.skills.filter(
    (skill) => skill.strength === 'moderate',
  );
  const missing = relevance.skills.filter(
    (skill) => skill.strength === 'missing',
  );

  return [
    {
      signal: {
        label: 'Weighted career skill evidence',
        max,
        earned: credit(max, relevance.score / 100),
        detail: `${relevance.score}% of the ${relevance.label.toLowerCase()} skill map is backed by evidence: ${strong.length} strong, ${moderate.length} partial, ${missing.length} missing. Partial evidence counts half.`,
        evidence: strong
          .slice(0, 3)
          .flatMap((skill) => skill.sources.slice(0, 1)),
      },
      improvement:
        missing.length === 0 && moderate.length === 0
          ? undefined
          : {
              title: 'Strengthen career-specific evidence',
              detail: describeRelevanceGap(relevance, missing, moderate),
            },
    },
  ];
}

function describeRelevanceGap(
  relevance: CareerRelevanceReport,
  missing: CareerRelevanceReport['skills'],
  moderate: CareerRelevanceReport['skills'],
): string {
  const heaviestMissing = [...missing]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2);
  const parts: string[] = [];

  if (heaviestMissing.length > 0) {
    parts.push(
      `No evidence of ${heaviestMissing.map((skill) => skill.label.toLowerCase()).join(' or ')} was found, and those carry the most weight for ${relevance.label.toLowerCase().replace(' relevance', '')}.`,
    );
  }

  if (moderate.length > 0) {
    parts.push(
      `${moderate.map((skill) => skill.label.toLowerCase()).join(', ')} only matched metadata — add code that uses ${moderate.length === 1 ? 'it' : 'them'} so the evidence becomes verifiable.`,
    );
  }

  return parts.join(' ');
}

// --- Project completeness ----------------------------------------------------------

function completenessSignals(context: AnalysisContext): BuiltSignal[] {
  const { repository, allPaths } = context;
  const hasManifest = context.dependencies.length > 0;
  const hasLicense =
    repository.licenseName !== null ||
    allPaths.some((path) => /^license/.test(path));
  const configSamples = allPaths.filter((path) =>
    /\.env\.example$|\.env\.sample$|config\.example\./.test(path),
  );
  const hasConfigSample = configSamples.length > 0;
  const needsConfig = context.codeEvidence.some(
    (evidence) => evidence.skillId === 'configuration',
  );
  const configEarned = hasConfigSample || !needsConfig;
  const hasMetadata =
    repository.description !== null && repository.topics.length > 0;
  const daysSincePush = repository.pushedAt
    ? daysSince(repository.pushedAt)
    : null;
  const isActive = daysSincePush !== null && daysSincePush <= 180;

  return [
    {
      signal: {
        label: 'Dependency manifest',
        max: 0.2,
        earned: hasManifest ? 0.2 : 0,
        detail: hasManifest
          ? `${context.dependencies.length} dependencies declared across the project manifests.`
          : 'No parseable dependency manifest was found.',
        evidence: hasManifest
          ? [
              {
                kind: 'dependency',
                label: 'Dependency manifest',
                path: context.dependencies[0]?.path,
              },
            ]
          : [
              {
                kind: 'static-analysis',
                label: 'No package.json, requirements.txt, or equivalent',
              },
            ],
      },
      improvement: hasManifest
        ? undefined
        : {
            title: 'Declare dependencies',
            detail:
              'Add a dependency manifest so the project can be installed reproducibly.',
          },
    },
    {
      signal: {
        label: 'License',
        max: 0.2,
        earned: hasLicense ? 0.2 : 0,
        detail: hasLicense
          ? `Licensed as ${repository.licenseName ?? 'declared in a LICENSE file'}.`
          : 'No license file or GitHub license metadata was found.',
        evidence: [
          hasLicense
            ? {
                kind: 'github',
                label: `License: ${repository.licenseName ?? 'LICENSE file'}`,
              }
            : { kind: 'static-analysis', label: 'No license detected' },
        ],
      },
      improvement: hasLicense
        ? undefined
        : {
            title: 'Add a license',
            detail:
              'Without a license, others legally cannot reuse the code. Add one to signal the project is meant to be shared.',
          },
    },
    {
      signal: {
        label: 'Configuration example',
        max: 0.2,
        earned: configEarned ? 0.2 : 0,
        detail: hasConfigSample
          ? `${configSamples[0]} documents the required configuration.`
          : needsConfig
            ? 'The code reads environment variables, but no .env.example documents which ones are required.'
            : 'The project does not appear to require environment configuration.',
        evidence: hasConfigSample
          ? [
              {
                kind: 'file',
                label: 'Configuration example',
                path: configSamples[0],
              },
            ]
          : context.codeEvidence
              .filter((evidence) => evidence.skillId === 'configuration')
              .slice(0, 1)
              .map((evidence) => ({
                kind: 'file' as const,
                label: evidence.detected,
                path: evidence.path,
                line: evidence.startLine,
              })),
      },
      improvement: configEarned
        ? undefined
        : {
            title: 'Add .env.example',
            detail: `The code reads environment variables${describeConfigSource(context)}, but nothing documents them. Add a .env.example listing every required key so the project can actually be run by someone else.`,
          },
    },
    {
      signal: {
        label: 'Repository metadata',
        max: 0.2,
        earned: hasMetadata ? 0.2 : 0,
        detail: hasMetadata
          ? `Description set and ${repository.topics.length} topic(s) applied.`
          : repository.description === null
            ? 'The repository has no description.'
            : 'The repository has no topics.',
        evidence: [
          { kind: 'github', label: 'Repository description and topics' },
        ],
      },
      improvement: hasMetadata
        ? undefined
        : {
            title: 'Complete the repository metadata',
            detail:
              repository.description === null
                ? 'Add a one-line GitHub description and topics. Both are indexed by search and are the first thing a reviewer reads.'
                : 'Add GitHub topics so the repository surfaces in searches for its technologies.',
          },
    },
    {
      signal: {
        label: 'Recent activity',
        max: 0.2,
        earned: isActive ? 0.2 : 0,
        detail:
          daysSincePush === null
            ? 'The repository has no recorded push date.'
            : `Last pushed ${daysSincePush} day(s) ago. Full credit within 180 days.`,
        evidence: [
          {
            kind: 'github',
            label: `Last push: ${repository.pushedAt ?? 'unknown'}`,
          },
        ],
      },
      improvement: isActive
        ? undefined
        : {
            title: 'Show recent activity',
            detail:
              'The repository has not been pushed to recently. Even small maintenance commits signal the project is alive rather than abandoned.',
          },
    },
  ];
}

function describeConfigSource(context: AnalysisContext): string {
  const evidence = context.codeEvidence.find(
    (item) => item.skillId === 'configuration',
  );
  return evidence ? ` in ${evidence.path}:${evidence.startLine}` : '';
}

// --- Shared path helpers -----------------------------------------------------------

export function isTestPath(path: string): boolean {
  return (
    /(^|\/)(__tests__|tests?|spec)\//.test(path) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    /(^|\/)test_[^/]+\.py$/.test(path) ||
    /_test\.(go|py|rb)$/.test(path)
  );
}

export function isSourcePath(path: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|go|java|rs|cs|cpp|cc|c|kt|swift|rb|scala|sql|ipynb)$/.test(
    path,
  );
}

function isConfigPath(path: string): boolean {
  return /(^|\/)(vite|vitest|jest|eslint|tailwind|next|rollup|webpack|babel)\.config\./.test(
    path,
  );
}

function topSourceDirectories(allPaths: string[], limit: number): string[] {
  const counts = new Map<string, number>();

  for (const path of allPaths.filter(isSourcePath)) {
    if (!path.includes('/')) {
      continue;
    }
    const directory = `${path.split('/')[0]}/`;
    counts.set(directory, (counts.get(directory) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([directory]) => directory);
}

function basename(path: string): string {
  return path.split('/').at(-1) ?? path;
}

function daysSince(isoDate: string): number {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(isoDate).getTime()) / millisecondsPerDay),
  );
}
