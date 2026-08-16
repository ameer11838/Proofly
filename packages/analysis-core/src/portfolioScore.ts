import {
  careerPathLabels,
  scoreCategoryLabels,
  type CareerPath,
  type CareerPortfolioScore,
  type GitHubRepository,
  type PortfolioContributor,
  type PortfolioCoverage,
  type RelevanceBand,
  type RepositoryAnalysisResponse,
  type RepositoryAnalysisStatus,
  type ScoreCategoryKey,
} from '@proofly/shared-types';
import { maxScore, round1 } from './scoreModel.js';

/** What the portfolio pass managed to do with one repository. */
export interface PortfolioRepositoryOutcome {
  repository: GitHubRepository;
  status: RepositoryAnalysisStatus;
  /** Present when the repository was read file-by-file. */
  analysis?: RepositoryAnalysisResponse;
  /** Present when the repository was skipped, explaining why. */
  skipReason?: string;
}

export interface PortfolioScoreInput {
  careerPath: CareerPath;
  outcomes: PortfolioRepositoryOutcome[];
  /** True when GitHub stopped serving requests before every repository was read. */
  rateLimited?: boolean;
}

/**
 * How many repositories carry the score. Beyond this the decayed weight is under 3%, so
 * including more would change the result by less than the rounding.
 */
const scoringDepth = 10;
/** Each successive repository counts 70% as much as the one above it. */
const decay = 0.7;
/** Career evidence strength at which a repository counts as a portfolio strength. */
const strongRepositoryThreshold = 6;

export function buildCareerPortfolioScore({
  careerPath,
  outcomes,
  rateLimited = false,
}: PortfolioScoreInput): CareerPortfolioScore {
  const label = `Overall ${careerPathLabels[careerPath]} score`;

  const analyzed = outcomes
    .filter(
      (
        outcome,
      ): outcome is PortfolioRepositoryOutcome & {
        analysis: RepositoryAnalysisResponse;
      } => outcome.analysis !== undefined,
    )
    .map((outcome) => ({
      outcome,
      strength: careerEvidenceStrength(outcome.analysis),
    }))
    .sort((a, b) => b.strength - a.strength);

  const analyses = analyzed.map((entry) => entry.outcome.analysis);
  const carrying = analyzed.slice(0, scoringDepth);
  const topStrength = carrying[0]?.strength ?? 0;

  /**
   * Influence falls off by rank *and* by how strong a repository is relative to the best
   * one, so a long tail of weak experiments cannot pull down a portfolio containing
   * strong work — which is exactly the user this score should reward.
   */
  const weights = carrying.map((entry, index) => {
    const relativeStrength =
      topStrength > 0 ? entry.strength / topStrength : index === 0 ? 1 : 0;
    return decay ** index * relativeStrength;
  });
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);

  const base =
    weightTotal > 0
      ? carrying.reduce(
          (sum, entry, index) => sum + entry.strength * (weights[index] ?? 0),
          0,
        ) / weightTotal
      : 0;

  const strongCount = analyzed.filter(
    (entry) => entry.strength >= strongRepositoryThreshold,
  ).length;
  const depthAdjustment = depthAdjustmentFor(strongCount);
  const score =
    analyzed.length === 0
      ? 1
      : clamp(round1(base + depthAdjustment), 1, maxScore);

  const contributionByFullName = new Map<string, number>();
  carrying.forEach((entry, index) => {
    contributionByFullName.set(
      entry.outcome.repository.fullName,
      weightTotal > 0 ? (weights[index] ?? 0) / weightTotal : 0,
    );
  });

  const strengthByFullName = new Map(
    analyzed.map((entry) => [
      entry.outcome.repository.fullName,
      entry.strength,
    ]),
  );

  const contributors = outcomes
    .map((outcome) =>
      toContributor(
        outcome,
        strengthByFullName.get(outcome.repository.fullName) ?? null,
        contributionByFullName.get(outcome.repository.fullName) ?? 0,
        topStrength,
      ),
    )
    .sort(
      (a, b) =>
        b.contribution - a.contribution ||
        (b.strength ?? -1) - (a.strength ?? -1) ||
        statusRank(a.status) - statusRank(b.status) ||
        a.name.localeCompare(b.name),
    );

  const coverage = buildCoverage(outcomes, rateLimited);

  return {
    careerPath,
    label,
    score,
    band: toBand(score),
    summary: buildSummary(careerPath, score, coverage, contributors),
    strongestEvidence: collectStrongestEvidence(analyses),
    portfolioStrengths: collectStrengths(analyses, strongCount, coverage),
    mainGaps: collectGaps(analyses),
    contributors,
    coverage,
    method: `Every repository is ranked from public metadata; forks are first verified across every available branch and are ranked and analyzed only from code added in commits attributed to the GitHub user. Each analyzed repository's strength follows the same project model: technical skills (30%), career relevance (25%), creativity and complexity (20%), project quality (15%), and presentation (10%). The strongest ${Math.min(
      scoringDepth,
      Math.max(analyzed.length, 1),
    )} then carry the score: influence drops ${Math.round(
      (1 - decay) * 100,
    )}% per position and in proportion to how strong a repository is next to the best one. Portfolio breadth finally adjusts the result by up to ±0.5 based on how many repositories reach strong career evidence.`,
    disclaimer:
      'This is an evidence-based portfolio assessment of public repositories, not a hiring score.',
  };
}

/**
 * Reconstructs the repository's overall strength from career relevance (25%) and the
 * normalized non-career project categories (75%). This keeps portfolio weighting aligned
 * with the five-category repository score instead of grading engineering hygiene twice.
 */
export function careerEvidenceStrength(
  analysis: RepositoryAnalysisResponse,
): number {
  const relevance = analysis.careerRelevance.score / 10;
  const engineering = analysis.engineering.score / 10;
  return 0.25 * relevance + 0.75 * engineering;
}

function toContributor(
  outcome: PortfolioRepositoryOutcome,
  strength: number | null,
  contribution: number,
  topStrength: number,
): PortfolioContributor {
  const { repository, analysis, status } = outcome;

  return {
    name: repository.name,
    fullName: repository.fullName,
    htmlUrl: repository.htmlUrl,
    status,
    careerRelevance: analysis
      ? round1(analysis.careerRelevance.score / 10)
      : null,
    engineering: analysis ? round1(analysis.engineering.score / 10) : null,
    strength: strength === null ? null : round1(strength),
    prooflyScore: analysis ? analysis.rating.score : null,
    contribution: round1(contribution * 100) / 100,
    userContribution: repository.userContribution,
    explanation: explainContribution(
      outcome,
      strength,
      contribution,
      topStrength,
    ),
  };
}

function explainContribution(
  outcome: PortfolioRepositoryOutcome,
  strength: number | null,
  contribution: number,
  topStrength: number,
): string {
  if (outcome.status === 'skipped') {
    return (
      outcome.skipReason ??
      'Not analyzed, so it contributed no evidence to the score.'
    );
  }

  if (outcome.status === 'metadata-only' || strength === null) {
    return 'Ranked from public metadata but never read, so it contributed no code evidence.';
  }

  if (contribution > 0) {
    const share = Math.round(contribution * 100);
    const attribution = outcome.repository.userContribution?.verified
      ? `${outcome.repository.userContribution.status}. `
      : '';
    return `${attribution}Carries ${share}% of the portfolio score on ${strength.toFixed(1)}/10 career evidence strength.`;
  }

  const gap = topStrength - strength;
  return `Analyzed, but at ${strength.toFixed(1)}/10 career evidence strength it ranks ${gap.toFixed(
    1,
  )} points below the strongest repository and falls outside the ${scoringDepth} that carry the score.`;
}

function statusRank(status: RepositoryAnalysisStatus): number {
  return status === 'deeply-analyzed' ? 0 : status === 'metadata-only' ? 1 : 2;
}

function buildCoverage(
  outcomes: PortfolioRepositoryOutcome[],
  rateLimited: boolean,
): PortfolioCoverage {
  const skipped = outcomes.filter((outcome) => outcome.status === 'skipped');
  const counts = new Map<string, number>();

  for (const outcome of skipped) {
    const reason = outcome.skipReason ?? 'Not analyzed.';
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  return {
    discovered: outcomes.length,
    // Ranking runs on every discovered repository, so metadata coverage is always total.
    metadataAnalyzed: outcomes.length,
    deeplyAnalyzed: outcomes.filter(
      (outcome) => outcome.status === 'deeply-analyzed',
    ).length,
    skipped: skipped.length,
    skipReasons: [...counts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    rateLimited,
  };
}

function depthAdjustmentFor(strongCount: number): number {
  if (strongCount >= 4) {
    return 0.5;
  }

  if (strongCount === 3) {
    return 0.3;
  }

  if (strongCount === 2) {
    return 0.1;
  }

  // Capped deliberately: a thin portfolio should not be punished as hard as a strong one
  // is rewarded.
  return strongCount === 1 ? -0.1 : -0.3;
}

function collectStrongestEvidence(
  analyses: RepositoryAnalysisResponse[],
): string[] {
  const languages = new Map<string, number>();
  for (const analysis of analyses) {
    const language = analysis.repository.language;
    if (language) {
      languages.set(language, (languages.get(language) ?? 0) + 1);
    }
  }

  const skills = new Map<string, { count: number; weight: number }>();
  for (const analysis of analyses) {
    for (const skill of analysis.careerRelevance.skills) {
      if (skill.strength !== 'strong') {
        continue;
      }

      const existing = skills.get(skill.label) ?? {
        count: 0,
        weight: skill.weight,
      };
      skills.set(skill.label, {
        count: existing.count + 1,
        weight: Math.max(existing.weight, skill.weight),
      });
    }
  }

  const topLanguages = [...languages.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([language]) => language);

  const topSkills = [...skills.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].weight - a[1].weight)
    .slice(0, 4)
    .map(([label]) => label);

  return [...topLanguages, ...topSkills];
}

function collectStrengths(
  analyses: RepositoryAnalysisResponse[],
  strongCount: number,
  coverage: PortfolioCoverage,
): string[] {
  const strengths: string[] = [];

  if (strongCount > 0) {
    strengths.push(
      `${strongCount} strong career-relevant ${strongCount === 1 ? 'repository' : 'repositories'}`,
    );
  }

  if (coverage.deeplyAnalyzed > 0) {
    strengths.push(
      `${coverage.deeplyAnalyzed} of ${coverage.discovered} ${
        coverage.discovered === 1 ? 'repository' : 'repositories'
      } read file-by-file`,
    );
  }

  for (const [key, ratio] of averageCategoryRatios(analyses)) {
    if (ratio >= 0.75) {
      strengths.push(
        `${scoreCategoryLabels[key].toLowerCase()} is consistently strong`,
      );
    }
  }

  return strengths.slice(0, 4);
}

function collectGaps(analyses: RepositoryAnalysisResponse[]): string[] {
  const gaps: string[] = [];

  for (const [key, ratio] of [...averageCategoryRatios(analyses)].reverse()) {
    // Naming "career relevance" as a gap inside a career score is circular; the missing
    // skills listed below say the same thing in a way the user can act on.
    if (key !== 'career-relevance' && ratio < 0.6 && gaps.length < 3) {
      gaps.push(scoreCategoryLabels[key].toLowerCase());
    }
  }

  // A high-weight skill missing from every analyzed repository is a real portfolio gap,
  // not a single repository's oversight. A skill proven anywhere is excluded, so the same
  // skill can never be listed as both strongest evidence and a gap.
  const provenSomewhere = new Set(
    analyses.flatMap((analysis) =>
      analysis.careerRelevance.skills
        .filter((skill) => skill.strength === 'strong')
        .map((skill) => skill.label),
    ),
  );

  const missingEverywhere = new Map<string, number>();
  for (const analysis of analyses) {
    for (const skill of analysis.careerRelevance.skills) {
      if (skill.strength === 'missing' && !provenSomewhere.has(skill.label)) {
        missingEverywhere.set(
          skill.label,
          (missingEverywhere.get(skill.label) ?? 0) + skill.weight,
        );
      }
    }
  }

  const universallyMissing = [...missingEverywhere.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label]) => label.toLowerCase());

  return [...new Set([...gaps, ...universallyMissing])].slice(0, 4);
}

function averageCategoryRatios(
  analyses: RepositoryAnalysisResponse[],
): [ScoreCategoryKey, number][] {
  const totals = new Map<ScoreCategoryKey, { earned: number; max: number }>();

  for (const analysis of analyses) {
    for (const category of analysis.breakdown.categories) {
      const existing = totals.get(category.key) ?? { earned: 0, max: 0 };
      totals.set(category.key, {
        earned: existing.earned + category.earned,
        max: existing.max + category.max,
      });
    }
  }

  return [...totals.entries()]
    .map(([key, value]): [ScoreCategoryKey, number] => [
      key,
      value.max > 0 ? value.earned / value.max : 0,
    ])
    .sort((a, b) => b[1] - a[1]);
}

function buildSummary(
  careerPath: CareerPath,
  score: number,
  coverage: PortfolioCoverage,
  contributors: PortfolioContributor[],
): string {
  if (coverage.deeplyAnalyzed === 0) {
    return `None of the ${coverage.discovered} discovered ${
      coverage.discovered === 1 ? 'repository' : 'repositories'
    } could be read file-by-file, so Proofly has no code evidence for a ${careerPathLabels[
      careerPath
    ].toLowerCase()} assessment.`;
  }

  const leader = contributors.find(
    (contributor) => contributor.contribution > 0,
  );
  const skipped = coverage.skipped > 0 ? `, ${coverage.skipped} skipped` : '';

  return `Scored ${score.toFixed(1)}/${maxScore.toFixed(0)} from ${coverage.deeplyAnalyzed} deeply analyzed ${
    coverage.deeplyAnalyzed === 1 ? 'repository' : 'repositories'
  } out of ${coverage.discovered} public ${
    coverage.discovered === 1 ? 'repository' : 'repositories'
  }${skipped}${
    leader && leader.strength !== null
      ? `, led by ${leader.name} at ${leader.strength.toFixed(1)}/10 career evidence strength`
      : ''
  }.`;
}

function toBand(score: number): RelevanceBand {
  if (score >= 7) {
    return 'Strong';
  }

  if (score >= 4.5) {
    return 'Moderate';
  }

  return 'Limited';
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
