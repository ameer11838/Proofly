import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage.js';

function renderHomePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
}

describe('HomePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and displays ranked repositories', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          username: 'octocat',
          careerPath: 'frontend-engineering',
          profile: {
            login: 'octocat',
            name: 'The Octocat',
            avatarUrl: 'https://github.com/images/error/octocat_happy.gif',
            profileUrl: 'https://github.com/octocat',
            bio: 'GitHub mascot',
            company: null,
            location: 'Internet',
            blog: null,
            publicRepos: 1,
            followers: 10,
            following: 1,
            createdAt: '2011-01-25T18:44:36Z',
          },
          repositories: [
            {
              relevanceScore: 92,
              relevanceLabel: 'High',
              evidence: [{ label: 'Language match', value: 'TypeScript is relevant.' }],
              repository: {
                id: 1,
                name: 'react-dashboard',
                fullName: 'octocat/react-dashboard',
                description: 'A frontend dashboard',
                htmlUrl: 'https://github.com/octocat/react-dashboard',
                homepage: null,
                language: 'TypeScript',
                topics: ['react'],
                stargazersCount: 4,
                forksCount: 1,
                watchersCount: 4,
                openIssuesCount: 0,
                size: 100,
                defaultBranch: 'main',
                licenseName: null,
                pushedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdAt: '2025-01-01T00:00:00Z',
                archived: false,
                fork: false,
                owner: {
                  login: 'octocat',
                  avatarUrl: 'https://github.com/images/error/octocat_happy.gif',
                  profileUrl: 'https://github.com/octocat',
                },
              },
            },
          ],
        }),
      ),
    );

    renderHomePage();

    await userEvent.type(screen.getByLabelText(/github username/i), 'octocat');
    await userEvent.selectOptions(screen.getByLabelText(/target career/i), 'frontend-engineering');
    await userEvent.click(screen.getByRole('button', { name: /rank repositories/i }));

    await waitFor(() => {
      expect(screen.getByText('react-dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText(/target career: frontend engineering/i)).toBeInTheDocument();
    expect(screen.getByText('The Octocat')).toBeInTheDocument();
  });
});
