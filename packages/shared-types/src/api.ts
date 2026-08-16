import type {
  EvidenceReference,
  EvidenceStrength,
  RelevanceBand,
} from './analysis.js';
import type { CareerPath } from './career.js';
import type { GitHubRepository, GitHubUserProfile } from './github.js';

export interface HealthResponse {
  status: 'ok';
  service: 'proofly-api';
  timestamp: string;
}

export interface RepoRankEvidence {
  label: string;
  value: string;
}

/**
 * One weighted component of the ranking score, so a repository's position can be
 * reconstructed from its parts.
 */
export interface RankComponent {
  label: string;
  earned: number;
  max: number;
  detail: string;
}

export interface RankedSkillMatch {
  id: string;
  label: string;
  strength: EvidenceStrength;
  matchedSignals: string[];
}

export interface RankedRepository {
  repository: GitHubRepository;
  relevanceScore: number;
  relevanceLabel: 'High' | 'Medium' | 'Low';
  evidence: RepoRankEvidence[];
  components: RankComponent[];
  /** Career-relevance share of the ranking score, 0-100. */
  careerRelevanceScore: number;
  careerRelevanceBand: RelevanceBand;
  /** Skills the repository metadata supports, strongest first. */
  topSkills: RankedSkillMatch[];
  strongestEvidence: RepoRankEvidence | null;
  /** Short explanation of why this repository sits where it does. */
  whyThisRanks: string;
  sources: EvidenceReference[];
}

export interface RepositoryListResponse {
  username: string;
  careerPath: CareerPath;
  profile: GitHubUserProfile;
  repositories: RankedRepository[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
