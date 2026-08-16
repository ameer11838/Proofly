import type {
  CareerPath,
  EvidenceReference,
  EvidenceStrength,
  GitHubRepository,
  RankComponent,
  RankedRepository,
  RankedSkillMatch,
  RelevanceBand,
  RepoRankEvidence,
} from '@proofly/shared-types';
import { getCareerSkillMap, type CareerSkill } from './careerSkillMap.js';

const componentMaxima = {
  careerSkills: 55,
  documentation: 15,
  activity: 15,
  // Stars and forks mostly track promotion rather than quality, so they are capped low.
  engagement: 5,
  substance: 10,
} as const;

const strengthFactor: Record<EvidenceStrength, number> = {
  strong: 1,
  moderate: 0.5,
  missing: 0,
};

export function rankRepositories(
  repositories: GitHubRepository[],
  careerPath: CareerPath,
): RankedRepository[] {
  return repositories
    .map((repository) => rankRepository(repository, careerPath))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Ranking runs on repository metadata only — no file contents are downloaded at this
 * stage — so it reports a metadata fit that the deep analysis can later confirm.
 */
export function rankRepository(
  repository: GitHubRepository,
  careerPath: CareerPath,
): RankedRepository {
  const { skills } = getCareerSkillMap(careerPath);
  const topics = repository.topics.map((topic) => topic.toLowerCase());
  const description = (repository.description ?? '').toLowerCase();
  const name = repository.name.toLowerCase().replace(/[-_]/g, ' ');

  // Skills that only reveal themselves inside source files (test coverage, error handling)
  // are excluded here: ranking reads metadata only, and counting them would penalise every
  // repository for evidence this pass cannot see. The deep analysis scores them instead.
  const observableSkills = skills.filter(
    (skill) =>
      (skill.languages?.length ?? 0) > 0 || (skill.topics?.length ?? 0) > 0,
  );

  const matches = observableSkills.map((skill) =>
    matchSkill(skill, { repository, topics, description, name }),
  );
  const totalWeight = matches.reduce((sum, match) => sum + match.weight, 0);
  const earnedWeight = matches.reduce(
    (sum, match) => sum + match.weight * strengthFactor[match.strength],
    0,
  );
  const careerRelevanceScore =
    totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  const components: RankComponent[] = [
    careerSkillComponent(matches, careerRelevanceScore),
    documentationComponent(repository),
    activityComponent(repository),
    engagementComponent(repository),
    substanceComponent(repository),
  ];

  const relevanceScore = Math.round(
    components.reduce((sum, component) => sum + component.earned, 0),
  );

  const topSkills: RankedSkillMatch[] = matches
    .filter((match) => match.strength !== 'missing')
    .sort(
      (a, b) =>
        b.weight * strengthFactor[b.strength] -
        a.weight * strengthFactor[a.strength],
    )
    .slice(0, 4)
    .map((match) => ({
      id: match.id,
      label: match.label,
      strength: match.strength,
      matchedSignals: match.matchedSignals,
    }));

  const evidence = buildEvidence(repository, components, topSkills);

  return {
    repository,
    relevanceScore,
    relevanceLabel: toRelevanceLabel(relevanceScore),
    evidence,
    components,
    careerRelevanceScore,
    careerRelevanceBand: toBand(careerRelevanceScore),
    topSkills,
    strongestEvidence: evidence[0] ?? null,
    whyThisRanks: explainRanking(
      repository,
      components,
      topSkills,
      careerRelevanceScore,
    ),
    sources: buildSources(repository, topSkills),
  };
}

interface SkillMatchContext {
  repository: GitHubRepository;
  topics: string[];
  description: string;
  name: string;
}

interface SkillMatchResult {
  id: string;
  label: string;
  weight: number;
  strength: EvidenceStrength;
  matchedSignals: string[];
}

function matchSkill(
  skill: CareerSkill,
  context: SkillMatchContext,
): SkillMatchResult {
  const matchedSignals: string[] = [];

  const languageMatch =
    context.repository.language !== null &&
    (skill.languages ?? []).includes(context.repository.language);
  if (languageMatch) {
    matchedSignals.push(`${context.repository.language} primary language`);
  }

  const topicMatches = (skill.topics ?? []).filter((topic) =>
    context.topics.includes(topic),
  );
  matchedSignals.push(...topicMatches.map((topic) => `topic "${topic}"`));

  // Technology names in the description are meaningful; generic words are not, which is
  // why only declared dependency and topic names are searched for here.
  const namedTechnologies = [
    ...(skill.dependencies ?? []),
    ...(skill.topics ?? []),
  ].filter(
    (technology) =>
      technology.length >= 4 && mentions(context.description, technology),
  );
  matchedSignals.push(
    ...namedTechnologies
      .slice(0, 3)
      .map((technology) => `"${technology}" in description`),
  );

  const strength = resolveStrength(
    languageMatch,
    topicMatches.length,
    namedTechnologies.length,
  );

  return {
    id: skill.id,
    label: skill.label,
    weight: skill.weight,
    strength,
    matchedSignals,
  };
}

function resolveStrength(
  languageMatch: boolean,
  topicMatches: number,
  namedTechnologies: number,
): EvidenceStrength {
  const signals = [
    languageMatch,
    topicMatches > 0,
    namedTechnologies > 0,
  ].filter(Boolean).length;

  if (topicMatches > 0 && signals >= 2) {
    return 'strong';
  }

  if (namedTechnologies > 0 && signals >= 2) {
    return 'strong';
  }

  return signals > 0 ? 'moderate' : 'missing';
}

function mentions(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

function careerSkillComponent(
  matches: SkillMatchResult[],
  careerRelevanceScore: number,
): RankComponent {
  const strong = matches.filter((match) => match.strength === 'strong');
  const moderate = matches.filter((match) => match.strength === 'moderate');

  return {
    label: 'Career skill match',
    earned: Math.round(
      (careerRelevanceScore / 100) * componentMaxima.careerSkills,
    ),
    max: componentMaxima.careerSkills,
    detail:
      strong.length + moderate.length === 0
        ? 'No career skill matched the language, topics, or description.'
        : `${strong.length} strong and ${moderate.length} partial skill match(es) from metadata: ${[
            ...strong,
            ...moderate,
          ]
            .slice(0, 3)
            .map((match) => match.label.toLowerCase())
            .join(', ')}.`,
  };
}

function documentationComponent(repository: GitHubRepository): RankComponent {
  const signals = [
    { met: repository.description !== null, label: 'description' },
    { met: repository.topics.length > 0, label: 'topics' },
    { met: repository.licenseName !== null, label: 'license' },
    {
      met: repository.homepage !== null && repository.homepage.length > 0,
      label: 'homepage',
    },
  ];
  const met = signals.filter((signal) => signal.met);

  return {
    label: 'Presentation',
    earned: Math.round(
      (met.length / signals.length) * componentMaxima.documentation,
    ),
    max: componentMaxima.documentation,
    detail:
      met.length === 0
        ? 'No description, topics, license, or homepage are set.'
        : `Has ${met.map((signal) => signal.label).join(', ')}.`,
  };
}

function activityComponent(repository: GitHubRepository): RankComponent {
  if (!repository.pushedAt) {
    return {
      label: 'Recent activity',
      earned: 0,
      max: componentMaxima.activity,
      detail: 'No push date is recorded for this repository.',
    };
  }

  const days = daysSince(repository.pushedAt);
  const fraction =
    days <= 30
      ? 1
      : days <= 90
        ? 0.8
        : days <= 180
          ? 0.6
          : days <= 365
            ? 0.3
            : 0;

  return {
    label: 'Recent activity',
    earned: Math.round(fraction * componentMaxima.activity),
    max: componentMaxima.activity,
    detail: `Last pushed ${days} day(s) ago.`,
  };
}

function engagementComponent(repository: GitHubRepository): RankComponent {
  const interactions = repository.stargazersCount + repository.forksCount;

  return {
    label: 'Public engagement',
    earned: Math.min(interactions, componentMaxima.engagement),
    max: componentMaxima.engagement,
    detail: `${repository.stargazersCount} star(s) and ${repository.forksCount} fork(s). This is a weak signal and is capped at ${componentMaxima.engagement} points.`,
  };
}

function substanceComponent(repository: GitHubRepository): RankComponent {
  const penalties: string[] = [];
  let earned = componentMaxima.substance;

  if (repository.fork) {
    earned -= 5;
    penalties.push('it is a fork');
  }

  if (repository.archived) {
    earned -= 3;
    penalties.push('it is archived');
  }

  if (repository.size < 100) {
    earned -= 4;
    penalties.push(`the checkout is only ${repository.size} KB`);
  }

  return {
    label: 'Project substance',
    earned: Math.max(0, earned),
    max: componentMaxima.substance,
    detail:
      penalties.length === 0
        ? 'Original, active repository with a meaningful amount of code.'
        : `Reduced because ${penalties.join(' and ')}.`,
  };
}

function buildEvidence(
  repository: GitHubRepository,
  components: RankComponent[],
  topSkills: RankedSkillMatch[],
): RepoRankEvidence[] {
  const evidence: RepoRankEvidence[] = [];

  for (const skill of topSkills.slice(0, 2)) {
    evidence.push({
      label: skill.label,
      value: skill.matchedSignals.join(', '),
    });
  }

  for (const component of [...components].sort((a, b) => b.earned - a.earned)) {
    if (component.earned > 0) {
      evidence.push({ label: component.label, value: component.detail });
    }
  }

  if (evidence.length === 0) {
    evidence.push({
      label: 'Limited metadata',
      value: `${repository.name} exposes no language, topic, description, or activity signal that matches this career.`,
    });
  }

  return evidence.slice(0, 5);
}

function buildSources(
  repository: GitHubRepository,
  topSkills: RankedSkillMatch[],
): EvidenceReference[] {
  const sources: EvidenceReference[] = [
    {
      kind: 'github',
      label: `Primary language: ${repository.language ?? 'not detected'}`,
    },
  ];

  if (repository.topics.length > 0) {
    sources.push({
      kind: 'github',
      label: `Topics: ${repository.topics.slice(0, 5).join(', ')}`,
    });
  }

  if (repository.description) {
    sources.push({ kind: 'github', label: 'Repository description' });
  }

  for (const skill of topSkills.slice(0, 2)) {
    sources.push({
      kind: 'static-analysis',
      label: `${skill.label}: ${skill.strength} metadata match`,
    });
  }

  return sources;
}

function explainRanking(
  repository: GitHubRepository,
  components: RankComponent[],
  topSkills: RankedSkillMatch[],
  careerRelevanceScore: number,
): string {
  const ordered = [...components].sort(
    (a, b) => b.earned / b.max - a.earned / a.max,
  );
  const best = ordered[0];
  const worst = ordered.at(-1);

  const skillPart =
    topSkills.length > 0
      ? `${repository.name} matches ${topSkills
          .slice(0, 2)
          .map((skill) => skill.label.toLowerCase())
          .join(' and ')} (${careerRelevanceScore}% of the career skill map)`
      : `${repository.name} matches none of the career skill map from its metadata (${careerRelevanceScore}%)`;

  const strengthPart = best
    ? `, and scores highest on ${best.label.toLowerCase()}`
    : '';
  const weaknessPart =
    worst && worst.earned < worst.max
      ? `. It loses the most on ${worst.label.toLowerCase()}: ${worst.detail.toLowerCase()}`
      : '.';

  return `${skillPart}${strengthPart}${weaknessPart}`;
}

function toRelevanceLabel(score: number): RankedRepository['relevanceLabel'] {
  if (score >= 60) {
    return 'High';
  }

  if (score >= 30) {
    return 'Medium';
  }

  return 'Low';
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

function daysSince(isoDate: string): number {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(isoDate).getTime()) / millisecondsPerDay),
  );
}
