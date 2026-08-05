# Analysis model

Proofly separates deterministic findings from AI-generated inference.

## Finding types

- Deterministic finding: directly observed from GitHub data, repository files, static analysis, or project metadata.
- AI inference: model-generated explanation based on a structured evidence package.
- Career suggestion: improvement advice connected to a selected target role.

## First-slice ranking

Repository ranking is not an employability score. It is a career-relevance estimate based on public repository metadata:

- primary language match
- repository name and description keyword match
- GitHub topics
- recent activity
- stars and forks as weak project maturity signals

Future scoring must show category weights, explain deductions, and separate objective observations from judgment.

## Repository evidence rating

The repository evidence rating is a 1-10 project-level rating, not a rating of the person. It is based on deterministic evidence from the repository tree and sampled safe text/code files.

Current rating inputs:

- README presence and completeness signals
- test-related files
- dependency manifests
- CI workflow files
- `.env.example` documentation
- sampled source-code organization
- career-specific language, topic, path, and content signals
- selected code-pattern checks such as TODO/FIXME markers, console debug statements, and suspected hardcoded secret patterns

The analyzer must not display suspected secret values. It may report the path and line where a risky pattern was detected.
