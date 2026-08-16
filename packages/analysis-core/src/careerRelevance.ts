import {
  careerRelevanceLabel,
  type CareerPath,
  type CareerRelevanceReport,
  type CodeEvidence,
  type EvidenceReference,
  type EvidenceStrength,
  type GitHubRepository,
  type RelevanceBand,
  type SkillEvidence,
} from '@proofly/shared-types';
import { getCareerSkillMap, type CareerSkill } from './careerSkillMap.js';
import { dependencyMatches, type DependencyRecord } from './dependencies.js';

export interface CareerRelevanceInput {
  repository: GitHubRepository;
  careerPath: CareerPath;
  /** Lowercase paths of every file Proofly downloaded. */
  lowerPaths: string[];
  dependencies: DependencyRecord[];
  codeEvidence: CodeEvidence[];
}

const strengthFactor: Record<EvidenceStrength, number> = {
  strong: 1,
  moderate: 0.5,
  missing: 0,
};

export function buildCareerRelevance({
  repository,
  careerPath,
  lowerPaths,
  dependencies,
  codeEvidence,
}: CareerRelevanceInput): CareerRelevanceReport {
  const { skills, summary } = getCareerSkillMap(careerPath);
  const topics = repository.topics.map((topic) => topic.toLowerCase());

  const evaluated = skills.map((skill) =>
    evaluateSkill(skill, {
      repository,
      topics,
      lowerPaths,
      dependencies,
      codeEvidence,
    }),
  );

  const totalWeight = evaluated.reduce((sum, skill) => sum + skill.weight, 0);
  const earnedWeight = evaluated.reduce(
    (sum, skill) => sum + skill.weight * strengthFactor[skill.strength],
    0,
  );
  const score =
    totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  const strong = evaluated.filter((skill) => skill.strength === 'strong');
  const moderate = evaluated.filter((skill) => skill.strength === 'moderate');
  const missing = evaluated.filter((skill) => skill.strength === 'missing');

  return {
    careerPath,
    label: careerRelevanceLabel(careerPath),
    score,
    band: toBand(score),
    summary: [
      summary,
      `${strong.length} of ${evaluated.length} skills are backed by strong evidence`,
      moderate.length > 0 ? `${moderate.length} by partial evidence` : null,
      missing.length > 0
        ? `${missing.length} were not found in the analyzed files`
        : null,
    ]
      .filter((part): part is string => part !== null)
      .join('. ')
      .concat('.'),
    skills: [...strong, ...moderate, ...missing],
  };
}

interface SkillContext {
  repository: GitHubRepository;
  topics: string[];
  lowerPaths: string[];
  dependencies: DependencyRecord[];
  codeEvidence: CodeEvidence[];
}

function evaluateSkill(
  skill: CareerSkill,
  context: SkillContext,
): SkillEvidence {
  const matchedSignals: string[] = [];
  const sources: EvidenceReference[] = [];

  const codeMatches = context.codeEvidence.filter(
    (evidence) => evidence.skillId === skill.id,
  );
  for (const evidence of codeMatches) {
    const matchLine = evidence.startLine + evidence.matchOffset - 1;
    matchedSignals.push(
      `${evidence.detected} in ${evidence.path}:${matchLine}`,
    );
    sources.push({
      kind: 'file',
      label: evidence.detected,
      path: evidence.path,
      line: matchLine,
    });
  }

  const languageMatch =
    context.repository.language !== null &&
    (skill.languages ?? []).includes(context.repository.language);
  if (languageMatch) {
    matchedSignals.push(`Primary language is ${context.repository.language}`);
    sources.push({
      kind: 'github',
      label: `Primary language: ${context.repository.language}`,
    });
  }

  const topicMatches = (skill.topics ?? []).filter((topic) =>
    context.topics.includes(topic),
  );
  for (const topic of topicMatches) {
    matchedSignals.push(`Repository topic "${topic}"`);
    sources.push({ kind: 'github', label: `Topic: ${topic}` });
  }

  const dependencyHits = (skill.dependencies ?? []).flatMap((expected) =>
    context.dependencies
      .filter((declared) => dependencyMatches(declared.name, expected))
      .map((declared) => declared),
  );
  const uniqueDependencyHits = dedupeBy(
    dependencyHits,
    (record) => `${record.path}:${record.name}`,
  );
  for (const record of uniqueDependencyHits.slice(0, 4)) {
    matchedSignals.push(`${record.name} declared in ${record.path}`);
    sources.push({
      kind: 'dependency',
      label: `${record.name} dependency`,
      path: record.path,
    });
  }

  const pathMatches = (skill.pathPatterns ?? []).flatMap((pattern) =>
    context.lowerPaths.filter((path) => pattern.test(path)),
  );
  const uniquePathMatches = [...new Set(pathMatches)];
  for (const path of uniquePathMatches.slice(0, 3)) {
    matchedSignals.push(`Relevant file ${path}`);
    sources.push({ kind: 'file', label: 'Career-relevant file', path });
  }

  const hasMetadataEvidence =
    languageMatch ||
    topicMatches.length > 0 ||
    uniqueDependencyHits.length > 0 ||
    uniquePathMatches.length > 0;
  const strength = resolveStrength({
    hasCode: codeMatches.length > 0,
    hasDependency: uniqueDependencyHits.length > 0,
    supportingMatches: [
      languageMatch,
      topicMatches.length > 0,
      uniquePathMatches.length > 0,
    ].filter(Boolean).length,
    hasMetadataEvidence,
  });

  return {
    id: skill.id,
    label: skill.label,
    description: skill.description,
    strength,
    weight: skill.weight,
    matchedSignals,
    sources,
    rationale: buildRationale(
      skill,
      strength,
      codeMatches.length,
      uniqueDependencyHits.length,
    ),
  };
}

function resolveStrength({
  hasCode,
  hasDependency,
  supportingMatches,
  hasMetadataEvidence,
}: {
  hasCode: boolean;
  hasDependency: boolean;
  supportingMatches: number;
  hasMetadataEvidence: boolean;
}): EvidenceStrength {
  if (hasCode) {
    return 'strong';
  }

  // A declared dependency plus a second independent signal is close to seeing the code.
  if (hasDependency && supportingMatches > 0) {
    return 'strong';
  }

  return hasMetadataEvidence ? 'moderate' : 'missing';
}

function buildRationale(
  skill: CareerSkill,
  strength: EvidenceStrength,
  codeMatches: number,
  dependencyMatchCount: number,
): string {
  if (strength === 'strong' && codeMatches > 0) {
    return `Source code in this repository uses ${skill.label.toLowerCase()} directly, so Proofly can quote the lines that prove it.`;
  }

  if (strength === 'strong') {
    return `${dependencyMatchCount} matching dependency declaration(s) plus supporting repository metadata back this skill, though no usage line was quoted from the sampled files.`;
  }

  if (strength === 'moderate') {
    return `Repository metadata points at ${skill.label.toLowerCase()}, but no code in the analyzed files demonstrates it. Proofly counts this as partial evidence only.`;
  }

  return `Nothing in the analyzed files, dependencies, topics, or languages demonstrates ${skill.label.toLowerCase()}.`;
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

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const itemKey = key(item);
    if (seen.has(itemKey)) {
      return false;
    }
    seen.add(itemKey);
    return true;
  });
}
