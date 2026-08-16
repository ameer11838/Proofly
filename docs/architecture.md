# Proofly architecture

Proofly is organized as a monorepo with separate applications and reusable packages.

## Applications

- `apps/web`: React, TypeScript, Vite, Tailwind CSS, and TanStack Query.
- `apps/api`: Node.js, TypeScript, and Express.

## Packages

- `packages/shared-types`: API contracts and domain types shared by the frontend and backend.
- `packages/analysis-core`: deterministic career relevance and evidence primitives.

## Current MVP boundary

The first vertical slice intentionally avoids authentication, persistence, Gemini, and deep repository source-code analysis. It proves the product loop:

1. Enter a GitHub username.
2. Select a target career.
3. Fetch public repositories through the backend.
4. Verify fork authorship across all branches, then rank repositories with documented
   deterministic evidence signals.
5. Display loading, empty, and error states in a polished frontend.

## Future analysis pipeline

The deeper repository analysis should be implemented as separate modules:

1. GitHub retrieval.
2. Repository filtering.
3. Deterministic static analysis.
4. Evidence package creation.
5. AI explanation.
6. Structured response validation.
7. API controller response.

Gemini should receive only filtered evidence and selected excerpts, never a whole unfiltered repository.

## Routing note

React Router is part of the intended frontend stack, but this first slice has only one screen. It is intentionally not installed in the runtime yet because the currently resolved React Router versions reported high-severity npm audit advisories during setup. Add it back when Proofly has multiple pages and a clean patched version is available.
