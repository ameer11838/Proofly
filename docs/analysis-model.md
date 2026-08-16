# Analysis model

Proofly's guiding rule: **show the user why Proofly reached its conclusion.** Every number on
screen must be traceable to something observable in the repository — a file, a line, a
dependency, a topic, or a piece of GitHub metadata.

## Two passes

| Pass     | Input                                                                | Output                                        |
| -------- | -------------------------------------------------------------------- | --------------------------------------------- |
| Ranking  | Repository metadata; verified contribution paths/languages for forks | 0-100 evidence fit, with weighted components  |
| Analysis | Downloaded file contents plus the full tree                          | 0-10 Proofly score, with a category breakdown |

Ranking never claims more than metadata can support. Skills that are only visible inside
source files are excluded from the ranking denominator, so a repository is not penalised for
evidence that pass cannot see.

## Fork attribution

Forks are not rejected automatically. Proofly paginates every available branch and searches
for commits GitHub links to the analyzed login, with exact public-profile and GitHub noreply
email matches as additional identity evidence. Commits reachable from several branches are
deduplicated by SHA. Author-name matches are never sufficient, and merge diffs are excluded
because they may contain code written by the merged branch's contributors.

A fork with no verified non-merge commits is skipped. For a verified fork, ranking uses only
languages and paths inferred from the user's changed files. Deep analysis uses only lines the
user added in those commits; repository topics, description, engagement, and code belonging
to other contributors do not feed the repository or portfolio score.

## Ranking components (0-100)

| Component          | Max | Basis                                                                                                         |
| ------------------ | --- | ------------------------------------------------------------------------------------------------------------- |
| Career skill match | 55  | Weighted share of the career skill map matched by language, topics, and named technologies in the description |
| Presentation       | 15  | Description, topics, license, homepage                                                                        |
| Recent activity    | 15  | Days since last push                                                                                          |
| Public engagement  | 5   | Stars and forks, capped deliberately low                                                                      |
| Project substance  | 10  | Penalties for forks, archived repositories, and near-empty checkouts                                          |

Only declared dependency names and topic names are searched for in a description. Generic
words such as `src`, `module`, or `cli` are never treated as career evidence.

## The Proofly score (0-10)

The score is the sum of five portfolio-focused categories. Category points are expressed directly on
the 0-10 scale, so the breakdown always adds up to the score with nothing unexplained.

| Category                | Weight   |
| ----------------------- | -------- |
| Technical Skills        | 3.0      |
| Career Relevance        | 2.5      |
| Creativity & Complexity | 2.0      |
| Project Quality         | 1.5      |
| Presentation            | 1.0      |
| **Total**               | **10.0** |

Each category is itself the sum of its signals, and every signal carries the observation it
was derived from. All values are whole tenths, so the arithmetic is exact rather than
approximately correct.

Testing, CI/CD, documentation, error handling, architecture, structure, and completeness
remain visible as supporting checks. Tests and CI contribute only inside Project Quality;
missing them prevents full quality credit without overwhelming stronger implementation
evidence.

## Project strength and career relevance are separate

- **Project strength** (0-100%) rolls up Technical Skills, Creativity & Complexity, Project
  Quality, and Presentation.
- **Career relevance** (0-100%) is the weighted share of the selected career's skill map that
  the repository can prove, reported as "<Career> relevance".

They move independently on purpose. A well-engineered project can be a weak match for a
career, and a strong career match can be poorly engineered. Only the career-relevance
category feeds the selected career into the score. Portfolio weighting uses the same 75%
project-strength / 25% career-relevance split as the repository score.

## Rating calibration

| Score | Rating      | Intended interpretation                                    |
| ----- | ----------- | ---------------------------------------------------------- |
| 1–2   | Starting    | Very small, basic, or substantially incomplete work        |
| 3–4   | Developing  | Some real implementation, but limited depth or completion  |
| 5–6   | Solid       | A legitimate working student or early-career project       |
| 7–8   | Strong      | Resume-worthy evidence with meaningful depth and relevance |
| 9–10  | Exceptional | Unusually deep, relevant, complex, and polished work       |

## Career skill maps

Each career declares skills with a weight and observable signals: languages, GitHub topics,
manifest dependencies, file path patterns, and line-level code patterns. Skill strength is:

- **Strong** — a source line demonstrates it, or a declared dependency plus a second
  independent signal does.
- **Moderate** — metadata points at it but no code demonstrates it. Counts half.
- **Missing** — nothing supports it. Proofly does not claim the skill.

A code signal with no explicit file filter only applies to source files, so a technology
mentioned in a README or installed in a CI step is never quoted as usage of it.

## Code evidence

When a signal matches, Proofly quotes the surrounding lines verbatim from the inspected
source, with the matched line highlighted and a permalink to the same range on GitHub. For a
fork, the fragment is drawn from added lines in a verified commit and links to that commit.
Fragments are never synthesized, never whole files, and are skipped for comment-only lines,
manifests, lock files, and generated or minified files.

## Code quality and readability

Proofly runs conservative static checks over the source files it actually downloaded. The
separate 0–10 Code Quality assessment reports Readability, Modularity, Error handling,
Documentation, and Maintainability. Its findings cover observable signals such as bounded or
long functions, dense branching, module size, repeated implementation blocks, vague naming,
type bypasses, boundary validation, explicit or silenced error paths, response validation,
configuration, SQL interpolation, risky dynamic execution, TODO/FIXME markers, and whether
non-obvious logic has useful decision context.

Every strength and improvement includes a file, line range, verbatim fragment, rationale,
and specific next step. Pattern matches are deliberately described as what Proofly observed
(for example, “no response check was found nearby”), not as unprovable runtime behavior.
Code-quality findings deepen Technical Skills feedback but do not change the five category
weights or manufacture score points.

## Development activity

Commit history is limited to commits GitHub attributes to the analyzed account. Fork reports
reuse the all-branch identity audit; owned repositories inspect the default branch. Proofly
reports descriptive versus vague subjects, active days, unusually large commits when diff
statistics are available, and recent activity. Commit count is context only: the application
never recommends artificial commits or awards points merely for increasing the count.

## Improvement plan

Scored improvements are derived from unearned signal points, so the projected score is
arithmetic rather than a promise. Source-quality improvements carry no invented point value;
they are prioritized separately by severity, include affected paths, and explain a concrete
approach. Quick wins are separated from higher-impact engineering work.

## File sampling

The analysis reads a bounded sample of the tree, prioritised as: root README, dependency
manifests, CI configuration, configuration examples, tests, source files, then everything
else. Per-type quotas stop one file kind (a repository with 13 workflows, say) from consuming
the whole budget. Every file in the tree is reported as analyzed or ignored with the reason,
so the sample is inspectable rather than implicit.

## Safety

Suspected secrets are redacted from file contents before analysis, so a redacted value can
never appear inside a displayed fragment. The analyzer reports the path and line of a risky
pattern but never the suspected value itself.
