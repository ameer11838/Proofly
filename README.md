# Proofly

Proofly is a GitHub portfolio intelligence tool for students, early-career developers, and other technology professionals. Enter a public GitHub username, select a target career, and Proofly answers:

> How strong is this project—and this portfolio—for the career I want?

Proofly ranks public repositories, reads a bounded sample of their source code, maps observable evidence to career-specific skills, and produces explainable repository and portfolio scores. Every conclusion is connected to GitHub metadata, a dependency, a file, a commit, or an exact source-code fragment.

The current scoring and feedback pipeline is deterministic. Despite the broader AI-oriented product direction, this version does **not** call an LLM and does not require an OpenAI, Gemini, or other AI API key.

## What Proofly does

- Ranks a GitHub user's public repositories for a selected technology career.
- Analyzes repository source code instead of relying only on stars, topics, or descriptions.
- Scores projects from 1–10 across five portfolio-focused categories.
- Separates general project strength from career-specific relevance.
- Detects languages, frameworks, dependencies, APIs, databases, algorithms, AI/ML signals, testing, CI/CD, error handling, documentation, and project structure.
- Shows exact source fragments as evidence for technical and career claims.
- Produces code-quality findings and prioritized, evidence-backed improvements.
- Builds an overall career score from the user's strongest repositories.
- Verifies a user's contributions to forked repositories across all available branches.
- Excludes code written by other contributors when analyzing a verified fork.

## How it works

```text
GitHub username + target career
              |
              v
     Fetch public GitHub data
              |
              v
 Verify contributions to every fork
              |
              v
 Rank repositories from observable metadata
              |
              v
 Inspect selected files or verified fork patches
              |
              v
 Extract dependencies, skills, quality signals,
 commit activity, and source-code evidence
              |
              v
 Calculate repository and portfolio scores
              |
              v
 Display an interactive, explainable report
```

### 1. Repository discovery and ranking

Proofly fetches the GitHub profile and up to the first 100 public owner repositories, ordered by recent updates. Each repository receives an initial 0–100 metadata ranking based on:

| Ranking component     | Maximum |
| --------------------- | ------: |
| Career skill match    |      55 |
| Presentation metadata |      15 |
| Recent activity       |      15 |
| Public engagement     |       5 |
| Project substance     |      10 |

This ranking is a discovery tool, not the final Proofly score. It uses only evidence visible at the metadata stage, such as language, topics, description, activity, size, and limited engagement signals.

### 2. Source inspection

For a normal repository, Proofly reads the recursive tree of the default branch and selects a bounded source sample. It prioritizes:

1. Root README
2. Dependency manifests
3. CI configuration
4. Environment/configuration examples
5. Tests
6. Main source files
7. Infrastructure and schema files
8. Documentation and supporting files

Current analysis limits are:

- Up to 24 selected files
- Up to 45 KB per file
- Up to 220 KB of source content per repository
- Six concurrent raw-file downloads

Dependencies, generated output, lock files, binaries, and common build directories are ignored. The final report lists what was analyzed, what was ignored, and why.

### 3. Career evidence

Each supported career has a weighted skill map. Skills can be supported by:

- Primary language
- GitHub topics
- Declared dependencies
- Relevant file paths
- Exact source-code patterns

Evidence is classified as:

- **Strong:** source code directly demonstrates the skill, or a dependency is supported by another independent signal.
- **Moderate:** metadata suggests the skill, but sampled code does not prove its use.
- **Missing:** no reliable supporting evidence was found.

Moderate evidence receives partial credit. Proofly does not claim a skill when it only appears in README prose or a CI installation command.

### 4. Code and quality evidence

When a reliable source pattern is found, Proofly returns a small verbatim fragment with its file, line range, explanation, score impact, and GitHub link. It also runs conservative static checks for readability, modularity, error handling, documentation, and maintainability.

The report may identify signals such as bounded or oversized modules, long functions, dense branching, input validation, explicit failure paths, unsafe SQL interpolation, risky dynamic execution, repeated code, configuration handling, and TODO/FIXME markers.

### 5. Development activity

Proofly reports attributable commit history, descriptive versus vague commit subjects, active development days, recency, and unusually large commits when GitHub provides diff statistics. Commit count is context only and does not earn points by itself.

## Forked repository attribution

Forks are not automatically rejected. For every fork, Proofly:

1. Retrieves every available branch.
2. Searches each branch for commits attributable to the analyzed GitHub account.
3. Uses GitHub's linked author login, exact public-profile email matches, and exact GitHub noreply email matches as identity evidence.
4. Deduplicates commits that are reachable from multiple branches.
5. Excludes merge commits because their diff may contain code written by other people.
6. Retrieves the files and patches from the user's verified non-merge commits.
7. Analyzes only lines added by those commits.

A verified fork can produce a status such as:

```text
Contribution verified — 12 commits across 2 branches analyzed
```

If no contribution can be verified, the fork is skipped:

```text
Skipped — No contributions from this GitHub user were found.
```

For verified forks, repository-wide description, topics, stars, license, engagement, and code from other contributors do not contribute to the score. GitHub occasionally omits text patches for large or binary changes; those changes can be counted in the contribution audit but cannot become quoted code evidence.

## Scoring model

The repository score is the sum of five categories on a 10-point scale:

| Category                | Weight | What it measures                                                                                                        |
| ----------------------- | -----: | ----------------------------------------------------------------------------------------------------------------------- |
| Technical Skills        |    30% | Meaningful code, languages, frameworks, APIs, databases, algorithms, AI/ML, implementation breadth, and technical depth |
| Career Relevance        |    25% | How strongly the actual project evidence matches the selected career                                                    |
| Creativity & Complexity |    20% | Scope, originality, real-world problem framing, integrations, and non-trivial technical challenges                      |
| Project Quality         |    15% | Organization, error handling, completeness, testing, maintainability, and CI/CD when present                            |
| Presentation            |    10% | README, description, setup, usage, screenshots/demo, and architecture explanation                                       |

Testing and CI/CD are supporting quality signals. Missing them prevents full Project Quality credit but cannot outweigh meaningful technical implementation.

### Rating scale

| Score | Rating      | Interpretation                                             |
| ----- | ----------- | ---------------------------------------------------------- |
| 1–2   | Starting    | Very small, basic, or substantially incomplete work        |
| 3–4   | Developing  | Real implementation with limited depth or completion       |
| 5–6   | Solid       | A legitimate working student or early-career project       |
| 7–8   | Strong      | Resume-worthy evidence with meaningful depth and relevance |
| 9–10  | Exceptional | Unusually deep, relevant, complex, and polished work       |

### Project strength and career relevance

Proofly reports these separately:

- **Project strength** measures Technical Skills, Creativity & Complexity, Project Quality, and Presentation.
- **Career relevance** measures the weighted share of the selected career's skill map supported by repository evidence.

A strong project can be a weak match for a particular career, and a relevant project can still need more technical depth or polish.

### Portfolio score

Each deeply analyzed repository receives a career evidence strength:

```text
75% project strength + 25% career relevance
```

The portfolio score is carried by up to the ten strongest repositories. Influence decays by rank and by strength relative to the best project, so a long tail of small experiments does not heavily reduce an otherwise strong portfolio. A small breadth adjustment rewards multiple strong repositories without severely punishing a thin portfolio.

For a complete description of the formulas and evidence rules, see [docs/analysis-model.md](docs/analysis-model.md).

## Supported career paths

- Software engineering
- Frontend engineering
- Backend engineering
- Full-stack engineering
- Machine learning and AI
- Data science
- Data engineering
- Cybersecurity
- DevOps and cloud engineering
- FinTech
- Quantitative development

## Technology stack

Proofly is an npm-workspaces TypeScript monorepo.

### Web application

- React 19
- TypeScript
- Vite 7
- Tailwind CSS 3
- TanStack React Query
- PostCSS and Autoprefixer
- Vitest, React Testing Library, and jsdom

### API

- Node.js
- TypeScript with ES modules
- Express 5
- Zod request validation
- CORS
- dotenv
- Native `fetch`
- Vitest and Supertest

### Shared packages

- `packages/shared-types` contains the API contracts and domain models shared by the frontend and backend.
- `packages/analysis-core` contains deterministic ranking, career mapping, dependency parsing, static analysis, evidence extraction, repository scoring, and portfolio scoring.

See [docs/architecture.md](docs/architecture.md) for more architectural context.

## Project structure

```text
apps/
  api/                  Express API and GitHub integration
    src/controllers/    HTTP and SSE request handlers
    src/github/         GitHub REST client
    src/services/       Contribution, repository, and portfolio workflows
    src/validation/     Zod request schemas
  web/                  React application
    src/api/            JSON and SSE API clients
    src/components/     Report and interaction components
    src/lib/            Progress reducers and theme state
    src/pages/          Main application page

packages/
  analysis-core/        Deterministic evidence and scoring engine
  shared-types/         Shared TypeScript contracts

docs/
  analysis-model.md     Detailed evidence and scoring model
  architecture.md       Product and code architecture
```

## API routes

| Method | Route                                                            | Purpose                                                                 |
| ------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `GET`  | `/health`                                                        | API health check                                                        |
| `GET`  | `/api/github/users/:username/repos?careerPath=...`               | Fetch profile and ranked repositories                                   |
| `GET`  | `/api/github/users/:username/career-score?careerPath=...`        | Build a portfolio score as JSON                                         |
| `GET`  | `/api/github/users/:username/career-score/stream?careerPath=...` | Stream portfolio progress and the final score with Server-Sent Events   |
| `GET`  | `/api/github/repos/:owner/:repo/analysis?careerPath=...`         | Analyze one repository as JSON                                          |
| `GET`  | `/api/github/repos/:owner/:repo/analysis/stream?careerPath=...`  | Stream repository progress and the final report with Server-Sent Events |

The backend calls GitHub's public REST API for profiles, repositories, branches, trees, commits, and commit details. Raw text files are downloaded from `raw.githubusercontent.com`.

## Run Proofly locally

### Prerequisites

Install:

- [Node.js](https://nodejs.org/) `20.19.0+` or `22.12.0+`
- npm, which is included with Node.js
- Git

No database, Docker container, GitHub OAuth app, or AI provider account is required.

### 1. Clone and enter the repository

```bash
git clone <your-proofly-repository-url>
cd Proofly
```

If the repository is already on your computer, open a terminal in its root directory instead.

### 2. Install dependencies

```bash
npm install
```

Run this once from the repository root. npm installs the web app, API, and shared workspace packages together.

### 3. Create the API environment file

```bash
cp apps/api/.env.example apps/api/.env
```

The file contains:

```env
PORT=4000
WEB_ORIGIN=http://localhost:5173
GITHUB_TOKEN=
```

You may leave `GITHUB_TOKEN` blank for a quick test, but a token is recommended because fork verification can make many GitHub API requests.

### 4. Add a GitHub token (recommended)

Proofly needs **no token** to read public GitHub data at a low request rate. GitHub currently limits unauthenticated REST requests to 60 per hour per IP, while authenticated personal requests generally receive up to 5,000 per hour. Analyzing several repositories—and especially inspecting every branch of a fork—can exhaust the unauthenticated limit quickly.

Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) and give it only read access to public repository metadata/content. Proofly does not need write, administration, issues, pull-request, workflow, package, or organization permissions. GitHub recommends fine-grained personal access tokens for personal REST API use; public endpoints can also be called without authentication. See GitHub's [REST authentication](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api) and [rate-limit](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) documentation.

Set the token in `apps/api/.env`:

```env
GITHUB_TOKEN=github_pat_your_token_here
```

Important:

- Keep the token in `apps/api/.env`; never put it in frontend code or a `VITE_` variable.
- Do not commit the token to Git.
- Use read-only access and the shortest practical expiration.
- Proofly currently analyzes public repositories only, even if the token can access private repositories.

### 5. Build the shared packages and applications

```bash
npm run build
```

This builds, in dependency order:

1. `@proofly/shared-types`
2. `@proofly/analysis-core`
3. `@proofly/api`
4. `@proofly/web`

### 6. Start the website and API

```bash
npm run dev
```

This starts both development servers:

- Website: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:4000](http://localhost:4000)
- Health check: [http://localhost:4000/health](http://localhost:4000/health)

Open `http://localhost:5173`, enter a public GitHub username, choose a career, and submit the form. Ranking appears first; the deeper portfolio score continues through streamed progress. Use **Analyze code and score 0–10** on a repository card to open its full evidence report.

Press `Ctrl+C` in the terminal to stop both development servers.

### Optional: use a different API URL

The browser defaults to `http://localhost:4000`. If the API is hosted elsewhere, create `apps/web/.env.local`:

```env
VITE_API_BASE_URL=https://your-api.example.com
```

Also set the API's `WEB_ORIGIN` to the exact frontend origin allowed by CORS.

## Development commands

Run commands from the repository root:

| Command             | Purpose                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `npm run dev`       | Start the API and web development servers                            |
| `npm run build`     | Build all workspaces in dependency order                             |
| `npm run test`      | Build shared packages and run the analysis, API, and web test suites |
| `npm run typecheck` | Type-check all workspaces                                            |
| `npm run lint`      | Run ESLint across the monorepo                                       |
| `npm run format`    | Format the repository with Prettier                                  |

## Troubleshooting

### GitHub rate limit reached

Add a valid read-only `GITHUB_TOKEN` to `apps/api/.env`, restart `npm run dev`, and retry. Portfolio and fork analysis use more API requests than the initial repository ranking.

### The website cannot reach the API

Confirm that:

- The API is running on port `4000`.
- `VITE_API_BASE_URL` points to the correct API origin if you changed it.
- `WEB_ORIGIN` matches the website origin exactly.
- Nothing else is already using ports `4000` or `5173`.

### A fork is skipped

Proofly only accepts commits reliably tied to the analyzed GitHub account. A matching author name is insufficient. Check whether the commits are linked to the account login, public profile email, or GitHub noreply address. GitHub may also temporarily prevent verification when the API rate limit is exhausted.

### Some files were ignored

This is expected. Proofly uses an inspectable sampling budget and excludes dependencies, build output, generated files, lock files, binaries, unsupported text formats, and oversized files. Open **Files Proofly inspected** in the report to see the reason for every included or excluded path.

## Current product boundary

- Public GitHub repositories only
- No GitHub OAuth or private-repository access
- No accounts, database, or saved report history
- No LLM calls in the current scoring pipeline
- Default-branch source analysis for non-fork repositories
- All-branch commit verification for forks
- Bounded source sampling rather than a full clone

Proofly's scores are portfolio evidence assessments, not hiring decisions. They describe what the inspected public evidence demonstrates and remain limited by GitHub availability, repository sampling, and static-analysis coverage.
