import type { CareerPath } from '@proofly/shared-types';

export interface CareerCriteria {
  languages: string[];
  keywords: string[];
  topics: string[];
}

export const careerCriteria: Record<CareerPath, CareerCriteria> = {
  'software-engineering': {
    languages: ['TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'Rust', 'C#', 'C++'],
    keywords: ['api', 'service', 'system', 'architecture', 'testing', 'cli', 'library'],
    topics: ['testing', 'algorithms', 'systems', 'api', 'typescript'],
  },
  'frontend-engineering': {
    languages: ['TypeScript', 'JavaScript', 'CSS', 'HTML'],
    keywords: ['react', 'vue', 'frontend', 'ui', 'design-system', 'component', 'vite'],
    topics: ['react', 'frontend', 'ui', 'tailwind', 'accessibility'],
  },
  'backend-engineering': {
    languages: ['TypeScript', 'JavaScript', 'Python', 'Go', 'Java', 'Rust', 'C#'],
    keywords: ['api', 'server', 'backend', 'database', 'auth', 'queue', 'microservice'],
    topics: ['api', 'backend', 'postgres', 'express', 'database'],
  },
  'full-stack-engineering': {
    languages: ['TypeScript', 'JavaScript', 'Python', 'SQL'],
    keywords: ['fullstack', 'full-stack', 'react', 'api', 'database', 'auth', 'dashboard'],
    topics: ['fullstack', 'react', 'api', 'postgres', 'saas'],
  },
  'machine-learning-ai': {
    languages: ['Python', 'Jupyter Notebook', 'R', 'C++'],
    keywords: ['model', 'ml', 'ai', 'training', 'inference', 'rag', 'llm', 'evaluation'],
    topics: ['machine-learning', 'ai', 'deep-learning', 'llm', 'pytorch', 'tensorflow'],
  },
  'data-science': {
    languages: ['Python', 'Jupyter Notebook', 'R', 'SQL'],
    keywords: ['analysis', 'notebook', 'dataset', 'visualization', 'statistics', 'eda'],
    topics: ['data-science', 'analytics', 'visualization', 'pandas', 'statistics'],
  },
  'data-engineering': {
    languages: ['Python', 'SQL', 'Scala', 'Java', 'Go'],
    keywords: ['pipeline', 'etl', 'warehouse', 'spark', 'airflow', 'streaming', 'dbt'],
    topics: ['data-engineering', 'etl', 'airflow', 'spark', 'dbt'],
  },
  cybersecurity: {
    languages: ['Python', 'Go', 'Rust', 'C', 'C++', 'Shell'],
    keywords: ['security', 'scanner', 'vulnerability', 'ctf', 'crypto', 'forensics'],
    topics: ['security', 'cybersecurity', 'ctf', 'vulnerability', 'cryptography'],
  },
  'devops-cloud-engineering': {
    languages: ['Shell', 'Go', 'Python', 'HCL', 'Dockerfile', 'TypeScript'],
    keywords: ['docker', 'kubernetes', 'terraform', 'ci', 'cd', 'aws', 'cloud', 'infra'],
    topics: ['devops', 'docker', 'kubernetes', 'terraform', 'aws', 'ci-cd'],
  },
  'financial-technology': {
    languages: ['TypeScript', 'Python', 'Java', 'Go', 'SQL'],
    keywords: ['finance', 'payment', 'trading', 'ledger', 'risk', 'banking', 'crypto'],
    topics: ['fintech', 'payments', 'trading', 'blockchain', 'finance'],
  },
};
