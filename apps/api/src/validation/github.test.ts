import { describe, expect, it } from 'vitest';
import { githubUsernameSchema } from './github.js';

describe('githubUsernameSchema', () => {
  it('accepts valid GitHub usernames', () => {
    expect(githubUsernameSchema.safeParse('octocat').success).toBe(true);
    expect(githubUsernameSchema.safeParse('openai-2026').success).toBe(true);
  });

  it('rejects invalid GitHub usernames', () => {
    expect(githubUsernameSchema.safeParse('-octocat').success).toBe(false);
    expect(githubUsernameSchema.safeParse('octocat-').success).toBe(false);
    expect(githubUsernameSchema.safeParse('bad/name').success).toBe(false);
  });
});
