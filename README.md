# Proofly

Proofly turns a developer's public GitHub profile into an evidence-backed portfolio review. It reads the actual repository code—not just stars and descriptions—to reveal what the developer built, which technical skills their work proves, and how strongly each project supports the career they want.

> How strong is this project for the career I want?

Users enter a GitHub username and select a target technology career. Proofly ranks their repositories, inspects the source code, identifies career-relevant skills, and produces explainable repository and portfolio scores with code fragments as evidence.

## What it does

- Scores projects across Technical Skills, Career Relevance, Creativity & Complexity, Project Quality, and Presentation.
- Detects languages, frameworks, APIs, databases, algorithms, AI/ML, testing, CI/CD, documentation, error handling, and code structure.
- Shows the files and source fragments behind its findings.
- Produces code-quality feedback and prioritized recommendations.
- Builds an overall career score from the user's strongest repositories.
- Checks every branch of a fork for commits attributable to the GitHub user.
- Analyzes only the user's verified additions to a fork and excludes work by other contributors.

The current scoring pipeline is deterministic and does not require an OpenAI, Gemini, or other AI API key.

## How the analysis works

1. The API retrieves the GitHub user's profile and up to 100 public repositories.
2. Proofly ranks repositories from career-skill matches, presentation, activity, engagement, and project substance.
3. For a normal repository, it inspects a prioritized sample of README, manifest, CI, test, source, and documentation files from the default branch.
4. For a fork, it checks all available branches, verifies commits through GitHub author/login/email evidence, and analyzes only lines added by that user.
5. The analysis engine extracts dependencies, career skills, code-quality signals, development activity, and source fragments before calculating repository and portfolio scores.

The repository score uses five categories:

| Category                | Weight |
| ----------------------- | -----: |
| Technical Skills        |    30% |
| Career Relevance        |    25% |
| Creativity & Complexity |    20% |
| Project Quality         |    15% |
| Presentation            |    10% |

Scores are rated as Starting, Developing, Solid, Strong, or Exceptional. Missing tests or CI limits Project Quality, but does not erase strong technical implementation.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, TanStack Query
- **Backend:** Node.js, Express 5, TypeScript, Zod
- **Analysis:** Custom deterministic static-analysis and scoring engine
- **Data:** GitHub REST API and `raw.githubusercontent.com`
- **Testing:** Vitest, React Testing Library, Supertest

The repository is an npm-workspaces monorepo:

```text
apps/web                 React website
apps/api                 Express API and GitHub integration
packages/analysis-core   Analysis and scoring engine
packages/shared-types    Shared TypeScript contracts
```

## APIs

The React app communicates with the local Express API. Long-running repository and portfolio analyses use Server-Sent Events so the UI can display real progress while files are being inspected.

### Proofly API routes

| Method | Route                                                            | Purpose                                                  |
| ------ | ---------------------------------------------------------------- | -------------------------------------------------------- |
| `GET`  | `/health`                                                        | Confirm that the API is running                          |
| `GET`  | `/api/github/users/:username/repos?careerPath=...`               | Return the GitHub profile and ranked repositories        |
| `GET`  | `/api/github/users/:username/career-score?careerPath=...`        | Return the complete portfolio score as JSON              |
| `GET`  | `/api/github/users/:username/career-score/stream?careerPath=...` | Stream portfolio progress and the final result           |
| `GET`  | `/api/github/repos/:owner/:repo/analysis?careerPath=...`         | Return one repository analysis as JSON                   |
| `GET`  | `/api/github/repos/:owner/:repo/analysis/stream?careerPath=...`  | Stream repository-analysis progress and the final report |

Supported `careerPath` values are `software-engineering`, `frontend-engineering`, `backend-engineering`, `full-stack-engineering`, `machine-learning-ai`, `data-science`, `data-engineering`, `cybersecurity`, `devops-cloud-engineering`, `financial-technology`, and `quantitative-development`.

### GitHub APIs used

The backend uses GitHub's public REST API to retrieve:

- User profiles and public owner repositories
- Repository metadata and recursive file trees
- All branches for fork verification
- Commits filtered by branch and author identity
- Detailed commit diffs and changed files

Selected text files are downloaded from `raw.githubusercontent.com`. GitHub requests are made by the backend so `GITHUB_TOKEN` is never exposed to the browser.

## Build and run locally

### Requirements

- Node.js `20.19.0+` or `22.12.0+`
- npm
- Git

### 1. Install dependencies

From the repository root:

```bash
npm install
```

### 2. Configure the API

Create the local environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

It should contain:

```env
PORT=4000
WEB_ORIGIN=http://localhost:5173
GITHUB_TOKEN=
```

`GITHUB_TOKEN` is optional, but recommended to avoid GitHub's low unauthenticated rate limit. Create a [fine-grained GitHub personal access token](https://github.com/settings/personal-access-tokens/new) with read-only public repository access, then add it to `apps/api/.env`:

```env
GITHUB_TOKEN=github_pat_your_token_here
```

Do not commit this token or expose it in frontend environment variables.

### 3. Build the project

```bash
npm run build
```

### 4. Start the website

```bash
npm run dev
```

Open:

- Website: [http://localhost:5173](http://localhost:5173)
- API health check: [http://localhost:4000/health](http://localhost:4000/health)

Enter a public GitHub username, select a career, and submit the form. Proofly will rank the repositories and begin building the portfolio analysis.

## Other commands

```bash
npm run test       # Run all tests
npm run typecheck  # Check TypeScript
npm run lint       # Run ESLint
```
