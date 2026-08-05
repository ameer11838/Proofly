export const careerPaths = [
  'software-engineering',
  'frontend-engineering',
  'backend-engineering',
  'full-stack-engineering',
  'machine-learning-ai',
  'data-science',
  'data-engineering',
  'cybersecurity',
  'devops-cloud-engineering',
  'financial-technology',
] as const;

export type CareerPath = (typeof careerPaths)[number];

export const careerPathLabels: Record<CareerPath, string> = {
  'software-engineering': 'Software engineering',
  'frontend-engineering': 'Frontend engineering',
  'backend-engineering': 'Backend engineering',
  'full-stack-engineering': 'Full-stack engineering',
  'machine-learning-ai': 'Machine learning and AI',
  'data-science': 'Data science',
  'data-engineering': 'Data engineering',
  cybersecurity: 'Cybersecurity',
  'devops-cloud-engineering': 'DevOps and cloud engineering',
  'financial-technology': 'Financial technology',
};
