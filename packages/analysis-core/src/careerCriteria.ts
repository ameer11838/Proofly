import { careerPaths, type CareerPath } from '@proofly/shared-types';
import { careerSkillMaps } from './careerSkillMap.js';

export interface CareerCriteria {
  languages: string[];
  topics: string[];
  dependencies: string[];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Metadata-level view of a career, derived from the skill map so the ranking pass and
 * the deep analysis pass can never disagree about what a career values.
 */
export const careerCriteria: Record<CareerPath, CareerCriteria> =
  Object.fromEntries(
    careerPaths.map((careerPath) => {
      const { skills } = careerSkillMaps[careerPath];

      return [
        careerPath,
        {
          languages: unique(skills.flatMap((skill) => skill.languages ?? [])),
          topics: unique(skills.flatMap((skill) => skill.topics ?? [])),
          dependencies: unique(
            skills.flatMap((skill) => skill.dependencies ?? []),
          ),
        },
      ];
    }),
  ) as Record<CareerPath, CareerCriteria>;
