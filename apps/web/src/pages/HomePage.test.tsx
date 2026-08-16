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

const rankedRepository = {
  relevanceScore: 77,
  relevanceLabel: 'High',
  evidence: [{ label: 'Component architecture', value: 'topic "react"' }],
  components: [
    {
      label: 'Career skill match',
      earned: 37,
      max: 50,
      detail:
        '2 strong and 0 partial skill match(es) from metadata: component architecture.',
    },
    {
      label: 'Presentation',
      earned: 11,
      max: 15,
      detail: 'Has description, topics, license.',
    },
  ],
  careerRelevanceScore: 73,
  careerRelevanceBand: 'Strong',
  topSkills: [
    {
      id: 'component-architecture',
      label: 'Component architecture',
      strength: 'strong',
      matchedSignals: ['topic "react"'],
    },
  ],
  strongestEvidence: {
    label: 'Component architecture',
    value: 'topic "react"',
  },
  whyThisRanks:
    'react-dashboard matches component architecture and styling systems (73% of the career skill map).',
  sources: [{ kind: 'github', label: 'Primary language: TypeScript' }],
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
};

const portfolio = {
  careerPath: 'frontend-engineering',
  label: 'Overall Frontend engineering score',
  score: 7.8,
  band: 'Strong',
  summary: 'Scored 7.8/10 from 3 deeply analyzed repositories out of 12.',
  strongestEvidence: [
    'TypeScript',
    'Component architecture',
    'Client data fetching',
  ],
  portfolioStrengths: ['3 strong career-relevant repositories'],
  mainGaps: ['testing', 'ci/cd and automation'],
  contributors: [
    {
      name: 'react-dashboard',
      fullName: 'octocat/react-dashboard',
      htmlUrl: 'https://github.com/octocat/react-dashboard',
      status: 'deeply-analyzed',
      prooflyScore: 8.1,
      careerRelevance: 8.2,
      engineering: 7.4,
      strength: 7.8,
      contribution: 0.46,
      explanation:
        'Carries 46% of the portfolio score on 7.8/10 career evidence strength.',
    },
    {
      name: 'old-fork',
      fullName: 'octocat/old-fork',
      htmlUrl: 'https://github.com/octocat/old-fork',
      status: 'skipped',
      prooflyScore: null,
      careerRelevance: null,
      engineering: null,
      strength: null,
      contribution: 0,
      explanation: 'No contributions from this GitHub user were found.',
    },
  ],
  coverage: {
    discovered: 20,
    metadataAnalyzed: 20,
    deeplyAnalyzed: 18,
    skipped: 2,
    skipReasons: [
      {
        reason: 'No contributions from this GitHub user were found.',
        count: 2,
      },
    ],
    rateLimited: false,
  },
  method: 'The strongest repositories are weighted most heavily.',
  disclaimer:
    'This is an evidence-based portfolio assessment of public repositories, not a hiring score.',
};

/** Frames the payload the way the server-sent stream does. */
function sseResponse(frames: { event: string; data: unknown }[]): Response {
  return new Response(
    frames
      .map(
        (frame) =>
          `event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`,
      )
      .join(''),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes('career-score')) {
        return sseResponse([
          {
            event: 'progress',
            data: {
              stage: 'discovering',
              status: 'complete',
              message: 'DISCOVERED 20 PUBLIC REPOSITORIES',
              counters: { discovered: 20 },
              stageProgress: 1,
            },
          },
          {
            event: 'result',
            data: {
              username: 'octocat',
              careerPath: 'frontend-engineering',
              portfolio,
            },
          },
        ]);
      }

      return Response.json({
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
        repositories: [rankedRepository],
      });
    }),
  );
}

async function search() {
  await userEvent.type(screen.getByLabelText(/github username/i), 'octocat');
  await userEvent.selectOptions(
    screen.getByLabelText(/target career/i),
    'frontend-engineering',
  );
  await userEvent.click(
    screen.getByRole('button', { name: /rank repositories/i }),
  );
}

describe('HomePage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and explains ranked repositories', async () => {
    stubApi();

    renderHomePage();

    await userEvent.type(screen.getByLabelText(/github username/i), 'octocat');
    await userEvent.selectOptions(
      screen.getByLabelText(/target career/i),
      'frontend-engineering',
    );
    await userEvent.click(
      screen.getByRole('button', { name: /rank repositories/i }),
    );

    await waitFor(() => {
      expect(screen.getByText('react-dashboard')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/target career: frontend engineering/i),
    ).toBeInTheDocument();
    expect(screen.getByText('The Octocat')).toBeInTheDocument();
    expect(screen.getByText(/why this ranks here/i)).toBeInTheDocument();
    expect(
      screen.getByText(/73% of the career skill map/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Component architecture').length,
    ).toBeGreaterThan(0);
  });

  it('shows the portfolio career score alongside the profile summary', async () => {
    stubApi();

    renderHomePage();
    await search();

    await waitFor(() => {
      expect(
        screen.getByText('Overall Frontend engineering score'),
      ).toBeInTheDocument();
    });

    // 7.8 appears both as the headline score and in the contributor breakdown.
    expect(screen.getAllByText('7.8').length).toBeGreaterThan(0);
    expect(screen.getByText('Strongest evidence')).toBeInTheDocument();
    expect(
      screen.getByText('3 strong career-relevant repositories'),
    ).toBeInTheDocument();
    expect(screen.getByText('Main gaps')).toBeInTheDocument();

    // The evidence chain and the disclaimer must both stay visible.
    expect(screen.getByText('portfolio career score')).toBeInTheDocument();
    expect(
      screen.getByText(
        /evidence-based portfolio assessment of public repositories/i,
      ),
    ).toBeInTheDocument();
  });

  it('states real analysis coverage rather than a fixed sample', async () => {
    stubApi();
    renderHomePage();
    await search();

    await waitFor(() => {
      expect(
        screen.getByText('18 of 20 repositories analyzed'),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        /20 discovered · 20 ranked · 18 deeply analyzed · 2 skipped/i,
      ),
    ).toBeInTheDocument();
  });

  it('shows how each repository contributed, including skipped ones', async () => {
    stubApi();
    renderHomePage();
    await search();

    await waitFor(() => {
      expect(
        screen.getByText('How each repository contributed'),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('46% of score')).toBeInTheDocument();
    // "Deeply analyzed" appears both as a coverage stat and as this repository's status.
    expect(screen.getAllByText('Deeply analyzed').length).toBeGreaterThan(0);
    expect(screen.getByText('Career evidence strength:')).toBeInTheDocument();
    expect(screen.getAllByText('7.8/10').length).toBeGreaterThan(0);

    // Skipped repositories are listed with their reason rather than hidden.
    expect(screen.getAllByText('Skipped').length).toBeGreaterThan(0);
    expect(screen.getByText('No contribution')).toBeInTheDocument();
    expect(
      screen.getAllByText(/no contributions from this github user/i).length,
    ).toBeGreaterThan(0);
  });

  it('toggles the theme and remembers the choice', async () => {
    renderHomePage();

    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await userEvent.click(
      screen.getByRole('button', { name: /switch to dark mode/i }),
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('proofly-theme')).toBe('dark');

    await userEvent.click(
      screen.getByRole('button', { name: /switch to light mode/i }),
    );

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem('proofly-theme')).toBe('light');
  });

  it('offers FinTech and quantitative development as target careers', () => {
    renderHomePage();

    const select = screen.getByLabelText(/target career/i);
    const options = [...select.querySelectorAll('option')].map(
      (option) => option.textContent,
    );

    expect(options).toContain('FinTech');
    expect(options).toContain('Quantitative development');
  });
});
