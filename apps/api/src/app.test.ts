import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';

const mockProfileResponse = {
  login: 'octocat',
  name: 'The Octocat',
  avatar_url: 'https://github.com/images/error/octocat_happy.gif',
  html_url: 'https://github.com/octocat',
  bio: 'GitHub mascot',
  company: null,
  location: 'Internet',
  blog: '',
  public_repos: 1,
  followers: 10,
  following: 1,
  created_at: '2011-01-25T18:44:36Z',
};

const mockRepo = {
  id: 1,
  name: 'react-dashboard',
  full_name: 'octocat/react-dashboard',
  description: 'Frontend dashboard built with React',
  html_url: 'https://github.com/octocat/react-dashboard',
  homepage: null,
  language: 'TypeScript',
  topics: ['react', 'frontend'],
  stargazers_count: 3,
  forks_count: 1,
  watchers_count: 3,
  open_issues_count: 0,
  size: 100,
  default_branch: 'main',
  license: { name: 'MIT License' },
  pushed_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_at: '2025-01-01T00:00:00Z',
  archived: false,
  fork: false,
  owner: {
    login: 'octocat',
    avatar_url: 'https://github.com/images/error/octocat_happy.gif',
    html_url: 'https://github.com/octocat',
  },
};

const mockGitHubResponse = [
  {
    ...mockRepo,
  },
];

describe('Proofly API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns health status', async () => {
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('returns ranked repositories for a valid username and career path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url.includes('/users/octocat/repos')) {
          return Response.json(mockGitHubResponse);
        }

        return Response.json(mockProfileResponse);
      }),
    );

    const response = await request(createApp()).get(
      '/api/github/users/octocat/repos?careerPath=frontend-engineering',
    );

    expect(response.status).toBe(200);
    expect(response.body.profile.login).toBe('octocat');
    expect(response.body.repositories).toHaveLength(1);
    expect(response.body.repositories[0].repository.name).toBe(
      'react-dashboard',
    );
    expect(response.body.repositories[0].relevanceLabel).toBe('High');
  });

  it('analyzes repository code and returns a 1-10 rating', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url.includes('/repos/octocat/react-dashboard/git/trees/main')) {
          return Response.json({
            truncated: false,
            tree: [
              { path: 'README.md', type: 'blob', size: 80 },
              { path: 'package.json', type: 'blob', size: 80 },
              { path: 'src/App.tsx', type: 'blob', size: 80 },
              { path: 'src/App.test.tsx', type: 'blob', size: 80 },
              { path: '.github/workflows/ci.yml', type: 'blob', size: 80 },
            ],
          });
        }

        if (url.includes('raw.githubusercontent.com')) {
          return new Response(
            '# React Dashboard\n\n## Setup\n\n## Usage\n\n## Tests\n',
            {
              status: 200,
            },
          );
        }

        return Response.json(mockRepo);
      }),
    );

    const response = await request(createApp()).get(
      '/api/github/repos/octocat/react-dashboard/analysis?careerPath=frontend-engineering',
    );

    expect(response.status).toBe(200);
    expect(response.body.rating.score).toBeGreaterThanOrEqual(1);
    expect(response.body.rating.score).toBeLessThanOrEqual(10);
    expect(response.body.findings.length).toBeGreaterThan(0);
  });

  it('streams real analysis progress and a final report', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url.includes('/git/trees/main')) {
          return Response.json({
            truncated: false,
            tree: [
              { path: 'README.md', type: 'blob', size: 80 },
              { path: 'package.json', type: 'blob', size: 80 },
              { path: 'src/App.tsx', type: 'blob', size: 80 },
            ],
          });
        }

        if (url.includes('raw.githubusercontent.com')) {
          return new Response('# React Dashboard\n\n## Setup\n\n## Usage\n', {
            status: 200,
          });
        }

        return Response.json(mockRepo);
      }),
    );

    const response = await request(createApp())
      .get(
        '/api/github/repos/octocat/react-dashboard/analysis/stream?careerPath=frontend-engineering',
      )
      .buffer(true)
      .parse((res, callback) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => callback(null, body));
      });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');

    const frames = String(response.body)
      .split('\n\n')
      .filter((frame) => frame.trim().length > 0);
    const events = frames.map((frame) => {
      const name = /^event: (.+)$/m.exec(frame)?.[1] ?? '';
      const data = /^data: (.+)$/m.exec(frame)?.[1] ?? '{}';
      return { name, payload: JSON.parse(data) as Record<string, unknown> };
    });

    const progress = events.filter((event) => event.name === 'progress');
    const result = events.find((event) => event.name === 'result');

    expect(progress.length).toBeGreaterThan(3);
    expect(result).toBeDefined();

    // Stages must arrive in the order the analyzer performs them.
    const order = [
      'fetching-repository',
      'inspecting-code',
      'extracting-evidence',
      'career-matching',
      'scoring',
      'building-report',
    ];
    const indexes = progress.map((event) =>
      order.indexOf(event.payload.stage as string),
    );
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));

    // Reported file names must be files the analyzer actually read.
    const reportedFiles = progress
      .map((event) => event.payload.file as string | undefined)
      .filter((file): file is string => typeof file === 'string');
    const analyzedFiles = (result?.payload.analyzedFiles ?? []) as string[];
    for (const file of reportedFiles) {
      expect(analyzedFiles).toContain(file);
    }
  });

  it('rejects invalid usernames', async () => {
    const response = await request(createApp()).get(
      '/api/github/users/bad_user/repos?careerPath=frontend-engineering',
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
