import { z } from 'zod';
import { careerPaths } from '@proofly/shared-types';

export const githubUsernameSchema = z
  .string()
  .min(1, 'GitHub username is required.')
  .max(39, 'GitHub usernames are at most 39 characters.')
  .regex(
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/,
    'Enter a valid GitHub username.',
  );

export const repositoryNameSchema = z
  .string()
  .min(1, 'Repository name is required.')
  .max(100, 'Repository names are at most 100 characters.')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Enter a valid GitHub repository name.');

export const repositoryQuerySchema = z.object({
  careerPath: z.enum(careerPaths),
});
