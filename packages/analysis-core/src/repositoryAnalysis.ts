import type {
  AnalysisProgressEvent,
  CareerPath,
  EngineeringEvidenceReport,
  FileInspectionReport,
  GitHubRepository,
  ImprovementPlan,
  RelevanceBand,
  RepositoryAnalysisFinding,
  RepositoryAnalysisResponse,
  RepositoryCommitEvidence,
  ScoreBreakdown,
  ScoreCategory,
  ScoreCategoryKey,
} from '@proofly/shared-types';
import {
  analyzeCodeQuality,
  analyzeDevelopmentActivity,
} from './codeQuality.js';
import { getCareerSkillMap } from './careerSkillMap.js';
import { buildCareerRelevance } from './careerRelevance.js';
import {
  extractCodeEvidence,
  type RepositoryFileEvidence,
} from './codeEvidence.js';
import { extractDependencies } from './dependencies.js';
import {
  buildScoreBreakdown,
  categoryWeights,
  maxScore,
  sumPoints,
  type AnalysisContext,
} from './scoreModel.js';

export type { RepositoryFileEvidence } from './codeEvidence.js';

export interface RepositoryAnalysisInput {
  repository: GitHubRepository;
  careerPath: CareerPath;
  /** Files whose contents were downloaded. */
  files: RepositoryFileEvidence[];
  totalFiles: number;
  /** Every path in the repository tree, so presence checks are not limited by sampling. */
  treePaths?: string[];
  fileReport?: FileInspectionReport;
  /** Commits attributable to the analyzed GitHub user. */
  commitHistory?: RepositoryCommitEvidence[];
  commitHistoryScope?: string;
  /** Called at each real phase boundary. Never called with estimated values. */
  onProgress?: (event: AnalysisProgressEvent) => void;
}

const engineeringCategories: ScoreCategoryKey[] = [
  'technical-skills',
  'creativity-complexity',
  'project-quality',
  'presentation',
];

export function analyzeRepositoryEvidence({
  repository,
  careerPath,
  files,
  totalFiles,
  treePaths,
  fileReport,
  commitHistory = [],
  commitHistoryScope,
  onProgress,
}: RepositoryAnalysisInput): RepositoryAnalysisResponse {
  const report = onProgress ?? (() => {});
  const paths = files.map((file) => file.path);
  const lowerPaths = paths.map((path) => path.toLowerCase());
  const allPaths = (treePaths ?? paths).map((path) => path.toLowerCase());

  // The root README is the one a reviewer sees on the repository page; a nested
  // doc/README is a fallback, not a substitute.
  const readmes = files.filter((file) =>
    /^readme(\.|$)/i.test(basename(file.path)),
  );
  const readme =
    readmes.find((file) => !file.path.includes('/')) ??
    [...readmes].sort((a, b) => depthOf(a.path) - depthOf(b.path))[0] ??
    null;
  const workflowFiles = files.filter((file) =>
    /^\.github\/workflows\/|\.gitlab-ci\.ya?ml$|jenkinsfile$/i.test(file.path),
  );
  const dependencies = extractDependencies(files);
  report({
    stage: 'extracting-evidence',
    status: 'active',
    message: `INSPECTED ${dependencies.length} DECLARED DEPENDENCIES`,
    counters: { dependencies: dependencies.length },
  });

  const { skills } = getCareerSkillMap(careerPath);
  report({
    stage: 'extracting-evidence',
    status: 'active',
    message: `MATCHING TECHNICAL SIGNALS ACROSS ${skills.length} SKILLS...`,
  });

  const codeEvidence = extractCodeEvidence(
    repository,
    files,
    skills,
    categoryWeights['career-relevance'],
  );
  const codeQuality = analyzeCodeQuality(repository, files);
  const developmentActivity = analyzeDevelopmentActivity(
    commitHistory,
    commitHistoryScope,
  );

  for (const evidence of codeEvidence) {
    report({
      stage: 'extracting-evidence',
      status: 'active',
      message: `CODE EVIDENCE FOUND: ${evidence.detected.toUpperCase()}`,
      file: evidence.path,
      evidence: {
        label: evidence.skillLabel,
        detected: evidence.detected,
        path: evidence.path,
        startLine: evidence.startLine,
        endLine: evidence.endLine,
      },
    });
  }

  for (const finding of codeQuality.findings.slice(0, 4)) {
    report({
      stage: 'extracting-evidence',
      status: 'active',
      message: `CODE QUALITY ${finding.kind.toUpperCase()}: ${finding.title.toUpperCase()}`,
      file: finding.path,
      evidence: {
        label:
          finding.kind === 'strength' ? 'Code strength' : 'Code improvement',
        detected: finding.title,
        path: finding.path,
        startLine: finding.startLine,
        endLine: finding.endLine,
      },
    });
  }

  report({
    stage: 'extracting-evidence',
    status: 'complete',
    message: `${codeEvidence.length + codeQuality.findings.length} SOURCE EVIDENCE SIGNAL(S) EXTRACTED`,
    counters: {
      evidenceSignals: codeEvidence.length + codeQuality.findings.length,
    },
  });

  report({
    stage: 'career-matching',
    status: 'active',
    message: `COMPARING EVIDENCE AGAINST ${skills.length} CAREER SKILLS...`,
  });

  const relevance = buildCareerRelevance({
    repository,
    careerPath,
    lowerPaths,
    dependencies,
    codeEvidence,
  });

  const strongSkills = relevance.skills.filter(
    (skill) => skill.strength === 'strong',
  );
  for (const skill of strongSkills) {
    report({
      stage: 'career-matching',
      status: 'active',
      message: `CAREER SIGNAL DETECTED: ${skill.label.toUpperCase()}`,
    });
  }

  report({
    stage: 'career-matching',
    status: 'complete',
    message: `${relevance.score}% CAREER RELEVANCE FROM ${strongSkills.length} STRONG SKILL(S)`,
    counters: { skillsMatched: strongSkills.length },
  });

  const context: AnalysisContext = {
    repository,
    allPaths,
    files,
    lowerPaths,
    readme,
    workflowFiles,
    dependencies,
    codeEvidence,
    relevance,
  };

  report({
    stage: 'scoring',
    status: 'active',
    message: 'SCORING PROJECT EVIDENCE ACROSS FIVE CATEGORIES...',
  });

  const { breakdown, improvementPlan: scoredImprovementPlan } =
    buildScoreBreakdown(context);
  const improvementPlan = addCodeQualityImprovements(
    scoredImprovementPlan,
    codeQuality.findings,
  );
  const engineering = buildEngineeringReport(breakdown);

  report({
    stage: 'scoring',
    status: 'complete',
    message: `PROOFLY SCORE ${breakdown.score.toFixed(1)}/${breakdown.maxScore.toFixed(0)} · ${engineering.score}% PROJECT STRENGTH`,
  });

  report({
    stage: 'building-report',
    status: 'active',
    message: 'BUILDING PORTFOLIO ASSESSMENT...',
  });

  const findings = buildFindings(context, breakdown, improvementPlan);

  report({
    stage: 'building-report',
    status: 'complete',
    message: `REPORT READY · ${findings.length} FINDING(S) · ${improvementPlan.actions.length} IMPROVEMENT(S)`,
  });

  return {
    repository,
    careerPath,
    rating: {
      score: breakdown.score,
      label: ratingLabel(breakdown.score),
      summary: summarizeRating(
        repository,
        breakdown,
        engineering,
        relevance.score,
        relevance.label,
      ),
      reasoning: breakdown.categories.map(
        (category) =>
          `${category.label}: ${category.earned.toFixed(1)}/${category.max.toFixed(1)} — ${describeCategory(category)}`,
      ),
    },
    breakdown,
    engineering,
    careerRelevance: relevance,
    codeEvidence,
    codeQuality,
    developmentActivity,
    improvementPlan,
    fileReport: fileReport ?? fallbackFileReport(paths, totalFiles, files),
    findings,
    suggestions: improvementPlan.actions.map((action) => action.detail),
    analyzedFiles: paths,
    ignoredFilesCount: Math.max(0, totalFiles - files.length),
  };
}

function addCodeQualityImprovements(
  plan: ImprovementPlan,
  findings: RepositoryAnalysisResponse['codeQuality']['findings'],
): ImprovementPlan {
  const severityOrder = { High: 0, Medium: 1, Low: 2 } as const;
  const codeActions = findings
    .filter((finding) => finding.kind === 'improvement')
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 5)
    .map((finding) => ({
      id: `code-${finding.id}`,
      title: finding.title,
      detail: finding.found,
      category: 'project-quality' as const,
      points: 0,
      impact: finding.severity,
      paths: [
        `${finding.path}:${finding.startLine}${finding.endLine > finding.startLine ? `–${finding.endLine}` : ''}`,
      ],
      suggestedApproach: finding.suggestion,
      example: finding.example,
      quickWin: finding.severity === 'Low',
    }));

  const scoredActions = plan.actions.map((action) => ({
    ...action,
    impact:
      action.impact ??
      (action.points >= 0.5
        ? ('High' as const)
        : action.points >= 0.3
          ? ('Medium' as const)
          : ('Low' as const)),
  }));

  return {
    ...plan,
    actions: [...codeActions, ...scoredActions].slice(0, 9),
  };
}

function buildEngineeringReport(
  breakdown: ScoreBreakdown,
): EngineeringEvidenceReport {
  const categories = breakdown.categories.filter((category) =>
    engineeringCategories.includes(category.key),
  );
  const earned = sumPoints(categories.map((category) => category.earned));
  const max = sumPoints(categories.map((category) => category.max));
  const score = max > 0 ? Math.round((earned / max) * 100) : 0;

  const weakest = [...categories].sort(
    (a, b) => a.earned / a.max - b.earned / b.max,
  )[0];
  const strongest = [...categories].sort(
    (a, b) => b.earned / b.max - a.earned / a.max,
  )[0];

  return {
    score,
    band: toBand(score),
    summary: `Project strength scores ${earned.toFixed(1)} of ${max.toFixed(1)} non-career points across technical skills, creativity and complexity, project quality, and presentation${
      strongest && weakest && strongest.key !== weakest.key
        ? `. Strongest area is ${strongest.label.toLowerCase()}, weakest is ${weakest.label.toLowerCase()}`
        : ''
    }.`,
    categories: engineeringCategories,
  };
}

function buildFindings(
  context: AnalysisContext,
  breakdown: ScoreBreakdown,
  improvementPlan: ImprovementPlan,
): RepositoryAnalysisFinding[] {
  const findings: RepositoryAnalysisFinding[] = breakdown.categories.map(
    (category) => {
      const ratio = category.max > 0 ? category.earned / category.max : 0;
      const action = improvementPlan.actions.find(
        (item) => item.category === category.key,
      );
      const unmet = category.signals.filter(
        (signal) => signal.earned < signal.max,
      );

      return {
        category: category.label,
        importance: ratio >= 0.75 ? 'Low' : ratio >= 0.4 ? 'Medium' : 'High',
        explanation: describeCategory(category),
        evidence: category.signals
          .flatMap((signal) => signal.evidence)
          .slice(0, 5),
        recommendation:
          action?.detail ??
          (unmet.length === 0
            ? `${category.label} is fully credited. Keep it current as the project changes.`
            : `Close the remaining gap in ${unmet.map((signal) => signal.label.toLowerCase()).join(' and ')}.`),
        careerRelevance:
          category.key === 'career-relevance'
            ? `${context.relevance.label} is scored separately from engineering quality: a strong project can still be a weak match for this career.`
            : `${category.label} contributes up to ${category.max.toFixed(1)} of the ${maxScore.toFixed(0)} available points for every career path.`,
      };
    },
  );

  return [...findings, ...codePatternFindings(context)];
}

function describeCategory(category: ScoreCategory): string {
  const met = category.signals.filter((signal) => signal.earned >= signal.max);
  const unmet = category.signals.filter((signal) => signal.earned < signal.max);

  if (unmet.length === 0) {
    return `Every check passed: ${met.map((signal) => signal.label.toLowerCase()).join(', ')}.`;
  }

  if (met.length === 0) {
    return `No checks passed. Missing: ${unmet.map((signal) => signal.label.toLowerCase()).join(', ')}.`;
  }

  return `Credited for ${met.map((signal) => signal.label.toLowerCase()).join(', ')}. Still missing ${unmet
    .map((signal) => signal.label.toLowerCase())
    .join(', ')}.`;
}

/**
 * Pattern checks that are not part of the score but are worth surfacing. The suspected
 * secret check reports only the location, never the value.
 */
function codePatternFindings(
  context: AnalysisContext,
): RepositoryAnalysisFinding[] {
  const findings: RepositoryAnalysisFinding[] = [];

  const possibleSecret = findFirst(
    context.files,
    /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}/i,
  );
  if (possibleSecret) {
    findings.push({
      category: 'Security hygiene',
      importance: 'High',
      explanation:
        'A possible hardcoded secret pattern was detected. Proofly intentionally does not display the suspected value.',
      evidence: [
        {
          kind: 'file',
          label: 'Possible hardcoded secret pattern',
          path: possibleSecret.path,
          line: possibleSecret.line,
        },
      ],
      recommendation: `Move the value at ${possibleSecret.path}:${possibleSecret.line} into an environment variable, rotate the credential if it was ever real, and document the key in .env.example.`,
      careerRelevance:
        'Security hygiene matters for every path, and disqualifies otherwise strong work in backend, cloud, FinTech, and security roles.',
    });
  }

  const todo = findFirst(context.files, /\b(TODO|FIXME)\b/);
  if (todo) {
    findings.push({
      category: 'Code maintainability',
      importance: 'Low',
      explanation: `A TODO or FIXME marker is left in ${todo.path}.`,
      evidence: [
        {
          kind: 'file',
          label: 'Maintenance marker',
          path: todo.path,
          line: todo.line,
        },
      ],
      recommendation: `Resolve the marker at ${todo.path}:${todo.line} or convert it into a tracked issue with context.`,
      careerRelevance:
        'Intentional TODOs are fine; stale ones read as abandoned work in a portfolio repository.',
    });
  }

  return findings;
}

function summarizeRating(
  repository: GitHubRepository,
  breakdown: ScoreBreakdown,
  engineering: EngineeringEvidenceReport,
  relevanceScore: number,
  relevanceLabel: string,
): string {
  const strongest = [...breakdown.categories].sort(
    (a, b) => b.earned / b.max - a.earned / a.max,
  )[0];

  return `${repository.name} scores ${breakdown.score.toFixed(1)}/${maxScore.toFixed(0)}: ${engineering.score}% project strength and ${relevanceScore}% ${relevanceLabel.toLowerCase()}${
    strongest ? `, carried most by ${strongest.label.toLowerCase()}` : ''
  }. Every point comes from the category breakdown below.`;
}

function fallbackFileReport(
  paths: string[],
  totalFiles: number,
  files: RepositoryFileEvidence[],
): FileInspectionReport {
  const ignoredCount = Math.max(0, totalFiles - files.length);

  return {
    totalFiles,
    analyzedCount: paths.length,
    ignoredCount,
    files: files.map((file) => ({
      path: file.path,
      status: 'analyzed' as const,
      reason: 'Downloaded and scanned for evidence.',
      sizeBytes: file.size,
    })),
    ignoredReasons:
      ignoredCount > 0
        ? [
            {
              reason: 'Not selected for content analysis.',
              count: ignoredCount,
            },
          ]
        : [],
    ignoredListTruncated: ignoredCount > 0,
  };
}

export function ratingLabel(
  score: number,
): RepositoryAnalysisResponse['rating']['label'] {
  if (score >= 9) {
    return 'Exceptional';
  }
  if (score >= 7) {
    return 'Strong';
  }
  if (score >= 5) {
    return 'Solid';
  }
  if (score >= 3) {
    return 'Developing';
  }
  return 'Starting';
}

function toBand(score: number): RelevanceBand {
  if (score >= 60) {
    return 'Strong';
  }
  if (score >= 30) {
    return 'Moderate';
  }
  return 'Limited';
}

function basename(path: string): string {
  return path.split('/').at(-1) ?? path;
}

function depthOf(path: string): number {
  return path.split('/').length;
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
