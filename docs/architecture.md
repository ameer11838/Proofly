# Proofly architecture

Proofly is organized as a monorepo with separate applications and reusable packages.

## Applications

- `apps/web`: React, TypeScript, Vite, Tailwind CSS, and TanStack Query.
- `apps/api`: Node.js, TypeScript, and Express.

## Packages

- `packages/shared-types`: API contracts and domain types shared by the frontend and backend.
- `packages/analysis-core`: deterministic career relevance and evidence primitives.

## Current product boundary

Proofly currently avoids authentication, persistence, and AI-only scoring. It implements
this evidence-first product loop:

1. Enter a GitHub username.
2. Select a target career.
3. Fetch public repositories through the backend.
4. Verify fork authorship across all branches, then rank repositories with documented
   deterministic evidence signals.
5. Download a bounded, inspectable source sample and analyze career evidence, code quality,
   readability/documentation, and attributable commit history.
6. Display the score, strengths, weaknesses, source fragments, development activity, and a
   prioritized improvement plan in an interactive report.

## Analysis pipeline

The deeper repository analysis should be implemented as separate modules:

1. GitHub retrieval.
2. Repository filtering.
3. Deterministic static analysis.
4. Evidence package creation.
5. Deterministic explanation and prioritized feedback.
6. Optional Gemini category assessment and narrative generated from the bounded evidence package.
7. A server-calculated repository score blending 70% deterministic and 30% Gemini scores.
8. Structured API response.

Gemini receives only filtered evidence and selected excerpts, never a whole unfiltered
repository. Its structured response is validated before use. Category scores are bounded by
the existing rubric and must cite evidence from the matching category. Proofly calculates
the blend in code and discards the Gemini response when it is incomplete, out of bounds,
cites unsupported evidence, or the API is unavailable.

## Routing note

React Router is part of the intended frontend stack, but this first slice has only one screen. It is intentionally not installed in the runtime yet because the currently resolved React Router versions reported high-severity npm audit advisories during setup. Add it back when Proofly has multiple pages and a clean patched version is available.
