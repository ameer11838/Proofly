import type { CareerPath } from './career.js';
import type { GitHubRepository } from './github.js';
import type {
  UserContributionReport,
  UserContributionSummary,
} from './contribution.js';

export interface EvidenceReference {
  kind: 'github' | 'file' | 'static-analysis' | 'dependency';
  label: string;
  path?: string;
  line?: number;
}

/**
 * The six categories that make up the Proofly score. Category points are expressed
 * directly on the 0-10 scale, so the categories always sum to the final score.
 */
export const scoreCategoryKeys = [
  'documentation',
  'testing',
  'ci-automation',
  'code-structure',
  'career-relevance',
  'project-completeness',
] as const;

export type ScoreCategoryKey = (typeof scoreCategoryKeys)[number];

export const scoreCategoryLabels: Record<ScoreCategoryKey, string> = {
  documentation: 'Documentation',
  testing: 'Testing',
  'ci-automation': 'CI/CD and automation',
  'code-structure': 'Code structure',
  'career-relevance': 'Career relevance',
  'project-completeness': 'Project completeness',
};

/**
 * One observable check inside a category. `earned` and `max` are already on the
 * 0-10 Proofly scale, and the signals of a category sum to that category's points.
 */
export interface ScoreSignal {
  label: string;
  earned: number;
  max: number;
  /** What Proofly actually observed, phrased so the user can verify it. */
  detail: string;
  evidence: EvidenceReference[];
}

export interface ScoreCategory {
  key: ScoreCategoryKey;
  label: string;
  description: string;
  earned: number;
  max: number;
  signals: ScoreSignal[];
}

export interface ScoreBreakdown {
  categories: ScoreCategory[];
  /** Sum of every category's earned points. This is the Proofly score. */
  score: number;
  maxScore: number;
}

export type EvidenceStrength = 'strong' | 'moderate' | 'missing';

export interface SkillEvidence {
  id: string;
  label: string;
  description: string;
  strength: EvidenceStrength;
  /** Relative importance of this skill inside the career skill map. */
  weight: number;
  matchedSignals: string[];
  sources: EvidenceReference[];
  rationale: string;
}

export type RelevanceBand = 'Strong' | 'Moderate' | 'Limited';

export interface CareerRelevanceReport {
  careerPath: CareerPath;
  /** For example "Quantitative development relevance". */
  label: string;
  /** 0-100, weighted across the career skill map. */
  score: number;
  band: RelevanceBand;
  summary: string;
  skills: SkillEvidence[];
}

export interface EngineeringEvidenceReport {
  /** 0-100, rolled up from the engineering-quality categories only. */
  score: number;
  band: RelevanceBand;
  summary: string;
  categories: ScoreCategoryKey[];
}

/**
 * A verbatim fragment taken from the analyzed repository. Proofly never synthesizes
 * these lines: `fragment` is always sliced out of a file it actually downloaded.
 */
export interface CodeEvidence {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  /** 1-indexed line inside `fragment` that triggered the detection. */
  matchOffset: number;
  language: string;
  fragment: string;
  detected: string;
  why: string;
  skillId: string;
  skillLabel: string;
  category: ScoreCategoryKey;
  scoreImpact: string;
  githubUrl: string;
  /** Commit containing this fragment when evidence came from a verified fork patch. */
  commitSha?: string;
}

export interface ImprovementAction {
  id: string;
  title: string;
  detail: string;
  category: ScoreCategoryKey;
  /** Unearned points this action can recover, on the 0-10 scale. */
  points: number;
}

export interface ImprovementPlan {
  currentScore: number;
  /** currentScore plus the points of every listed action. Never above the max score. */
  potentialScore: number;
  maxScore: number;
  actions: ImprovementAction[];
}

export type FileInspectionStatus = 'analyzed' | 'ignored';

export interface InspectedFile {
  path: string;
  status: FileInspectionStatus;
  /** Why the file was read, or why it was skipped. */
  reason: string;
  sizeBytes: number | null;
}

export interface FileInspectionReport {
  totalFiles: number;
  analyzedCount: number;
  ignoredCount: number;
  files: InspectedFile[];
  /** Ignored-file counts grouped by reason, covering every ignored file. */
  ignoredReasons: { reason: string; count: number }[];
  /** True when `files` omits some ignored entries to keep the response small. */
  ignoredListTruncated: boolean;
}

/**
 * Stages of a repository analysis, in the order the server actually performs them.
 * Progress reporting is stage-based because only file downloads have a knowable
 * denominator — nothing here is estimated or simulated.
 */
export const analysisStages = [
  'fetching-repository',
  'inspecting-code',
  'extracting-evidence',
  'career-matching',
  'scoring',
  'building-report',
] as const;

export type AnalysisStage = (typeof analysisStages)[number];

export const analysisStageLabels: Record<AnalysisStage, string> = {
  'fetching-repository': 'FETCHING REPOSITORY',
  'inspecting-code': 'INSPECTING CODE',
  'extracting-evidence': 'EXTRACTING EVIDENCE',
  'career-matching': 'CAREER MATCHING',
  scoring: 'SCORING',
  'building-report': 'BUILDING REPORT',
};

/**
 * Share of the overall progress bar each stage occupies. Measured against real analyses
 * rather than guessed: the two network-bound stages account for essentially all elapsed
 * time, while matching, scoring, and report assembly are pure in-memory work that
 * completes within a millisecond. Weighting them heavily would make the bar crawl through
 * the download and then leap at the end.
 */
export const analysisStageWeights: Record<AnalysisStage, number> = {
  'fetching-repository': 0.3,
  'inspecting-code': 0.55,
  'extracting-evidence': 0.06,
  'career-matching': 0.04,
  scoring: 0.03,
  'building-report': 0.02,
};

/** Counters carrying observed totals only. Absent means "not yet known". */
export interface AnalysisProgressCounters {
  filesSelected?: number;
  filesInspected?: number;
  dependencies?: number;
  evidenceSignals?: number;
  skillsMatched?: number;
}

/** A real code-evidence hit, surfaced while the analysis is still running. */
export interface AnalysisEvidenceFlash {
  label: string;
  detected: string;
  path: string;
  startLine: number;
  endLine: number;
}

export interface AnalysisProgressEvent {
  stage: AnalysisStage;
  status: 'active' | 'complete';
  /** Terminal-style status line. */
  message: string;
  /** Path of the file this event concerns, when it concerns one. */
  file?: string;
  counters?: AnalysisProgressCounters;
  evidence?: AnalysisEvidenceFlash;
  /** 0-1 progress inside the stage, only when it can be measured honestly. */
  stageProgress?: number;
}

export type RepositoryAnalysisStatus =
  'deeply-analyzed' | 'metadata-only' | 'skipped';

export const repositoryAnalysisStatusLabels: Record<
  RepositoryAnalysisStatus,
  string
> = {
  'deeply-analyzed': 'Deeply analyzed',
  'metadata-only': 'Metadata only',
  skipped: 'Skipped',
};

/**
 * One repository's contribution to the portfolio-level career score, so the user can
 * follow repository evidence → repository score → portfolio score. Every repository the
 * portfolio pass considered appears here, including the ones it could not read.
 */
export interface PortfolioContributor {
  name: string;
  fullName: string;
  htmlUrl: string;
  status: RepositoryAnalysisStatus;
  /** Career relevance on a 0-10 scale. Null when the repository was never read. */
  careerRelevance: number | null;
  /** Engineering evidence on a 0-10 scale. Null when the repository was never read. */
  engineering: number | null;
  /** Career evidence strength, 0-10, blending relevance and engineering. */
  strength: number | null;
  /** The repository's own 0-10 Proofly score. */
  prooflyScore: number | null;
  /** Share of the final score this repository accounts for, 0-1. Zero when it carried none. */
  contribution: number;
  /** Why this repository did or did not move the portfolio score. */
  explanation: string;
  /** Authorship verification for a fork. */
  userContribution?: UserContributionSummary;
}

/**
 * Exactly what the portfolio pass reached, so coverage is never implied by a single number.
 * `discovered` counts public repositories found; the other three partition them.
 */
export interface PortfolioCoverage {
  discovered: number;
  /** Ranked from public metadata. Every discovered repository gets at least this. */
  metadataAnalyzed: number;
  /** Read file-by-file. */
  deeplyAnalyzed: number;
  skipped: number;
  /** Counts of each distinct skip reason, covering every skipped repository. */
  skipReasons: { reason: string; count: number }[];
  /** True when GitHub stopped serving requests before every repository was read. */
  rateLimited: boolean;
}

export interface CareerPortfolioScore {
  careerPath: CareerPath;
  /** For example "Overall FinTech score". */
  label: string;
  /** 1-10, one decimal. */
  score: number;
  band: RelevanceBand;
  summary: string;
  strongestEvidence: string[];
  portfolioStrengths: string[];
  mainGaps: string[];
  contributors: PortfolioContributor[];
  coverage: PortfolioCoverage;
  /** Plain-language description of how the score was produced. */
  method: string;
  disclaimer: string;
}

/** Stages of the portfolio pass, in the order the server performs them. */
export const portfolioStages = [
  'discovering',
  'ranking',
  'analyzing',
  'scoring',
] as const;

export type PortfolioStage = (typeof portfolioStages)[number];

export const portfolioStageLabels: Record<PortfolioStage, string> = {
  discovering: 'DISCOVERING REPOSITORIES',
  ranking: 'RANKING BY CAREER FIT',
  analyzing: 'ANALYZING REPOSITORIES',
  scoring: 'SCORING PORTFOLIO',
};

export type PortfolioRepositoryState = 'analyzing' | 'analyzed' | 'skipped';

export interface PortfolioProgressEvent {
  stage: PortfolioStage;
  status: 'active' | 'complete';
  message: string;
  repository?: {
    name: string;
    state: PortfolioRepositoryState;
    /** Present when the repository was skipped. */
    reason?: string;
    /** Career evidence strength once the repository has been read. */
    strength?: number;
  };
  counters?: {
    discovered?: number;
    queued?: number;
    deeplyAnalyzed?: number;
    skipped?: number;
  };
  /** 0-1 within the stage. Only set where a real denominator exists. */
  stageProgress?: number;
}

export interface CareerScoreResponse {
  username: string;
  careerPath: CareerPath;
  portfolio: CareerPortfolioScore;
}

export interface RepositoryAnalysisFinding {
  category: string;
  importance: 'High' | 'Medium' | 'Low';
  explanation: string;
  evidence: EvidenceReference[];
  recommendation: string;
  careerRelevance: string;
}

export interface RepositoryEvidenceRating {
  score: number;
  label: 'Excellent' | 'Strong' | 'Developing' | 'Early';
  summary: string;
  reasoning: string[];
}

export interface RepositoryAnalysisResponse {
  repository: GitHubRepository;
  careerPath: CareerPath;
  rating: RepositoryEvidenceRating;
  breakdown: ScoreBreakdown;
  engineering: EngineeringEvidenceReport;
  careerRelevance: CareerRelevanceReport;
  codeEvidence: CodeEvidence[];
  improvementPlan: ImprovementPlan;
  fileReport: FileInspectionReport;
  findings: RepositoryAnalysisFinding[];
  suggestions: string[];
  analyzedFiles: string[];
  ignoredFilesCount: number;
  /** Full attribution audit when this analysis is limited to a fork user's patches. */
  userContribution?: UserContributionReport;
}
