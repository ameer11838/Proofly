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
  'quantitative-development',
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
  'financial-technology': 'FinTech',
  'quantitative-development': 'Quantitative development',
};

/**
 * Careers grouped for the target-career dropdown so a longer list stays scannable.
 */
export const careerPathGroups: { label: string; careerPaths: CareerPath[] }[] =
  [
    {
      label: 'Software',
      careerPaths: [
        'software-engineering',
        'frontend-engineering',
        'backend-engineering',
        'full-stack-engineering',
      ],
    },
    {
      label: 'Data and AI',
      careerPaths: ['machine-learning-ai', 'data-science', 'data-engineering'],
    },
    {
      label: 'Infrastructure and security',
      careerPaths: ['devops-cloud-engineering', 'cybersecurity'],
    },
    {
      label: 'Finance',
      careerPaths: ['financial-technology', 'quantitative-development'],
    },
  ];

/**
 * Label used when reporting how relevant a repository is to the selected career,
 * for example "Quantitative development relevance".
 */
export function careerRelevanceLabel(careerPath: CareerPath): string {
  return `${careerPathLabels[careerPath]} relevance`;
}
