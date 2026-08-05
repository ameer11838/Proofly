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

export interface RankedRepository {
  repository: GitHubRepository;
  relevanceScore: number;
  relevanceLabel: 'High' | 'Medium' | 'Low';
  evidence: RepoRankEvidence[];
}

export interface RepositoryListResponse {
  username: string;
  careerPath: CareerPath;
  profile: GitHubUserProfile;
  repositories: RankedRepository[];
}

export interface EvidenceReference {
  kind: 'github' | 'file' | 'static-analysis';
  label: string;
  path?: string;
  line?: number;
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
  findings: RepositoryAnalysisFinding[];
  suggestions: string[];
  analyzedFiles: string[];
  ignoredFilesCount: number;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
