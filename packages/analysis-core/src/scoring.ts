import type {
  CareerPath,
  GitHubRepository,
  RankedRepository,
  RepoRankEvidence,
} from '@proofly/shared-types';
import { careerCriteria } from './careerCriteria.js';

const maxScore = 100;

export function rankRepositories(
  repositories: GitHubRepository[],
  careerPath: CareerPath,
): RankedRepository[] {
  return repositories
    .map((repository) => rankRepository(repository, careerPath))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export function rankRepository(
  repository: GitHubRepository,
  careerPath: CareerPath,
): RankedRepository {
  const criteria = careerCriteria[careerPath];
  const evidence: RepoRankEvidence[] = [];
  let score = 0;

  if (repository.language && criteria.languages.includes(repository.language)) {
    score += 30;
    evidence.push({
      label: 'Language match',
      value: `${repository.language} is commonly relevant for this career path.`,
    });
  }

  const searchableText = [
    repository.name,
    repository.description ?? '',
    ...repository.topics,
  ]
    .join(' ')
    .toLowerCase();

  const keywordMatches = criteria.keywords.filter((keyword) =>
    searchableText.includes(keyword.toLowerCase()),
  );

  if (keywordMatches.length > 0) {
    const points = Math.min(keywordMatches.length * 10, 30);
    score += points;
    evidence.push({
      label: 'Keyword match',
      value: keywordMatches.slice(0, 4).join(', '),
    });
  }

  const topicMatches = repository.topics.filter((topic) =>
    criteria.topics.includes(topic.toLowerCase()),
  );

  if (topicMatches.length > 0) {
    const points = Math.min(topicMatches.length * 10, 20);
    score += points;
    evidence.push({
      label: 'Topic match',
      value: topicMatches.slice(0, 4).join(', '),
    });
  }

  if (repository.pushedAt) {
    const daysSincePush = daysBetween(new Date(repository.pushedAt), new Date());
    if (daysSincePush <= 90) {
      score += 10;
      evidence.push({
        label: 'Recent activity',
        value: `Updated within the last ${daysSincePush} days.`,
      });
    }
  }

  if (repository.stargazersCount > 0 || repository.forksCount > 0) {
    score += Math.min(repository.stargazersCount + repository.forksCount, 10);
    evidence.push({
      label: 'Public engagement',
      value: `${repository.stargazersCount} stars and ${repository.forksCount} forks.`,
    });
  }

  if (evidence.length === 0) {
    evidence.push({
      label: 'Limited metadata match',
      value: 'No strong language, keyword, topic, activity, or engagement signals were found.',
    });
  }

  const relevanceScore = Math.min(score, maxScore);

  return {
    repository,
    relevanceScore,
    relevanceLabel: toRelevanceLabel(relevanceScore),
    evidence,
  };
}

function toRelevanceLabel(score: number): RankedRepository['relevanceLabel'] {
  if (score >= 70) {
    return 'High';
  }

  if (score >= 35) {
    return 'Medium';
  }

  return 'Low';
}

function daysBetween(start: Date, end: Date): number {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay));
}
