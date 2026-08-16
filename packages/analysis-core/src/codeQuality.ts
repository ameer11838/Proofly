import type {
  CodeQualityDimension,
  CodeQualityDimensionKey,
  CodeQualityFinding,
  CodeQualityReport,
  DevelopmentActivityCommit,
  DevelopmentActivityReport,
  FindingSeverity,
  GitHubRepository,
  RepositoryCommitEvidence,
} from '@proofly/shared-types';
import type { RepositoryFileEvidence } from './codeEvidence.js';

const sourcePattern =
  /\.(ts|tsx|js|jsx|mjs|cjs|py|go|java|rs|cs|cpp|cc|c|kt|swift|rb|scala|sql)$/i;
const maxFindings = 24;

interface FindingCandidate {
  kind: 'strength' | 'improvement';
  severity: FindingSeverity;
  dimension: CodeQualityDimensionKey;
  path: string;
  line: number;
  endLine?: number;
  title: string;
  found: string;
  why: string;
  suggestion: string;
  example?: string;
}

const dimensionLabels: Record<CodeQualityDimensionKey, string> = {
  readability: 'Readability',
  modularity: 'Modularity',
  'error-handling': 'Error handling',
  documentation: 'Documentation',
  maintainability: 'Maintainability',
};

/**
 * Conservative static analysis over files Proofly actually downloaded. Each detector
 * emits a concrete source range and avoids claiming runtime behaviour it cannot prove.
 */
export function analyzeCodeQuality(
  repository: GitHubRepository,
  files: RepositoryFileEvidence[],
): CodeQualityReport {
  const sourceFiles = files.filter((file) => sourcePattern.test(file.path));
  const candidates: FindingCandidate[] = [];

  for (const file of sourceFiles) {
    candidates.push(...inspectFile(file));
  }
  candidates.push(...findDuplication(sourceFiles));

  const deduplicated = candidates
    .filter(
      (candidate, index, all) =>
        all.findIndex(
          (other) =>
            other.path === candidate.path &&
            other.line === candidate.line &&
            other.title === candidate.title,
        ) === index,
    )
    .sort(compareCandidates)
    .slice(0, maxFindings);

  const findings = deduplicated.map((candidate, index) =>
    materializeFinding(repository, files, candidate, index),
  );
  const dimensions = buildDimensions(sourceFiles, findings);
  const score =
    dimensions.length > 0
      ? round1(
          dimensions.reduce((sum, dimension) => sum + dimension.score, 0) /
            dimensions.length,
        )
      : 0;
  const strengths = findings.filter((finding) => finding.kind === 'strength');
  const improvements = findings.filter(
    (finding) => finding.kind === 'improvement',
  );

  return {
    score,
    summary:
      sourceFiles.length === 0
        ? 'No readable source files were available for code-quality analysis.'
        : `${sourceFiles.length} source file(s) inspected · ${strengths.length} supported strength(s) · ${improvements.length} improvement finding(s).`,
    dimensions,
    findings,
  };
}

export function analyzeDevelopmentActivity(
  commits: RepositoryCommitEvidence[],
  scope = 'default branch',
): DevelopmentActivityReport {
  const unique = [
    ...new Map(commits.map((commit) => [commit.sha, commit])).values(),
  ]
    .sort((a, b) => b.committedAt.localeCompare(a.committedAt))
    .slice(0, 100);
  const analyzed: DevelopmentActivityCommit[] = unique.map((commit) => {
    const subject = commit.message.split('\n')[0]?.trim() ?? '';
    const weak = isWeakCommitMessage(subject);
    return {
      ...commit,
      message: subject,
      quality: weak ? 'weak' : 'clear',
      reason: weak
        ? 'The subject is vague and does not identify the change.'
        : 'The subject names a concrete change or development milestone.',
    };
  });
  const weakMessageCount = analyzed.filter(
    (commit) => commit.quality === 'weak',
  ).length;
  const largeCommitCount = analyzed.filter(
    (commit) =>
      (commit.additions ?? 0) + (commit.deletions ?? 0) >= 1_000 ||
      (commit.changedFiles ?? 0) >= 40,
  ).length;
  const activeDays = new Set(
    analyzed.map((commit) => commit.committedAt.slice(0, 10)),
  ).size;
  const meaningfulCommitCount = analyzed.length - weakMessageCount;
  const dates = analyzed.map((commit) => commit.committedAt).sort();
  const lastCommitAt = dates.at(-1) ?? null;
  const recentDevelopment = lastCommitAt
    ? Date.now() - new Date(lastCommitAt).getTime() <=
      180 * 24 * 60 * 60 * 1_000
    : false;
  const traceable =
    meaningfulCommitCount >= 5 && weakMessageCount <= analyzed.length / 2;
  const label =
    analyzed.length === 0
      ? 'No attributable commits available'
      : traceable
        ? 'Good development history'
        : 'Development history is difficult to follow';

  return {
    scope,
    commitCount: analyzed.length,
    meaningfulCommitCount,
    weakMessageCount,
    largeCommitCount,
    activeDays,
    firstCommitAt: dates[0] ?? null,
    lastCommitAt,
    recentDevelopment,
    label,
    summary:
      analyzed.length === 0
        ? 'GitHub did not return commit history attributable to the analyzed user.'
        : `${analyzed.length} attributable commit(s) across ${activeDays} active day(s) on ${scope}; ${meaningfulCommitCount} use descriptive subjects${largeCommitCount > 0 ? ` and ${largeCommitCount} unusually large commit(s) may be harder to review` : ''}. Latest activity was ${recentDevelopment ? 'within the last six months' : `on ${lastCommitAt?.slice(0, 10)}`}. Commit count is context, not a scoring target.`,
    commits: analyzed.slice(0, 20),
  };
}

function inspectFile(file: RepositoryFileEvidence): FindingCandidate[] {
  const lines = file.content.split('\n');
  const findings: FindingCandidate[] = [];
  const language = extension(file.path);

  if (lines.length >= 500) {
    findings.push({
      kind: 'improvement',
      severity: lines.length >= 900 ? 'High' : 'Medium',
      dimension: 'modularity',
      path: file.path,
      line: 1,
      endLine: Math.min(lines.length, 12),
      title: 'Large source file',
      found: `${file.path} contains ${lines.length} lines and likely carries several responsibilities.`,
      why: 'Large modules are harder to navigate, review, test, and change safely.',
      suggestion:
        'Group related responsibilities and extract the clearest boundary into a focused module while keeping the public API stable.',
    });
  } else if (lines.length >= 40 && lines.length <= 260) {
    findings.push({
      kind: 'strength',
      severity: 'Low',
      dimension: 'modularity',
      path: file.path,
      line: 1,
      endLine: Math.min(lines.length, 8),
      title: 'Focused module size',
      found: `${file.path} stays focused at ${lines.length} lines.`,
      why: 'A bounded module is easier for another engineer to understand and change.',
      suggestion: 'Preserve this responsibility boundary as the project grows.',
    });
  }

  const functionRanges = findFunctions(lines, language);
  const longest = [...functionRanges].sort(
    (a, b) => b.endLine - b.startLine - (a.endLine - a.startLine),
  )[0];
  if (longest && longest.endLine - longest.startLine + 1 >= 70) {
    findings.push({
      kind: 'improvement',
      severity:
        longest.endLine - longest.startLine + 1 >= 120 ? 'High' : 'Medium',
      dimension: 'readability',
      path: file.path,
      line: longest.startLine,
      endLine: longest.endLine,
      title: 'Long function or method',
      found: `${longest.name} spans ${longest.endLine - longest.startLine + 1} lines.`,
      why: 'Long functions hide distinct decisions and make failures harder to isolate.',
      suggestion:
        'Extract a named helper around one coherent phase, then keep the original function responsible for orchestration.',
      example: `function ${longest.name}() {\n  const input = validateInput();\n  const result = performCoreStep(input);\n  return formatResult(result);\n}`,
    });
  } else if (longest && functionRanges.length >= 2) {
    findings.push({
      kind: 'strength',
      severity: 'Low',
      dimension: 'readability',
      path: file.path,
      line: longest.startLine,
      endLine: Math.min(longest.endLine, longest.startLine + 8),
      title: 'Functions remain bounded',
      found: `${functionRanges.length} detected functions are separated, and the longest is ${longest.endLine - longest.startLine + 1} lines.`,
      why: 'Shorter functions make control flow and responsibilities easier to review.',
      suggestion:
        'Keep extracting by responsibility when future features expand these functions.',
    });
  }

  const complexFunction = functionRanges.find((range) => {
    const body = lines.slice(range.startLine - 1, range.endLine).join('\n');
    return (
      (
        body.match(/\b(?:if|else if|for|while|switch|case|catch|except)\b/g) ??
        []
      ).length >= 10
    );
  });
  if (complexFunction) {
    findings.push({
      kind: 'improvement',
      severity: 'Medium',
      dimension: 'readability',
      path: file.path,
      line: complexFunction.startLine,
      endLine: Math.min(
        complexFunction.endLine,
        complexFunction.startLine + 12,
      ),
      title: 'Dense branching logic',
      found: `${complexFunction.name} contains at least ten control-flow branches in one function.`,
      why: 'Dense branching increases the number of paths a reader and test suite must reason about.',
      suggestion:
        'Extract a decision table, guard clauses, or named policy helpers around coherent groups of branches.',
    });
  }

  const vagueFunction = functionRanges.find((range) =>
    /^(?:doStuff|handle|process|run|data|thing|func|method)$/i.test(range.name),
  );
  if (vagueFunction) {
    findings.push({
      kind: 'improvement',
      severity: 'Low',
      dimension: 'readability',
      path: file.path,
      line: vagueFunction.startLine,
      title: 'Vague function name',
      found: `${vagueFunction.name} does not communicate the operation or result it owns.`,
      why: 'Specific names reduce the need to read an implementation before understanding a call site.',
      suggestion:
        'Rename it with a verb and domain object, such as validateRepositoryInput or buildPortfolioScore.',
    });
  }

  const checks: Array<{
    pattern: RegExp;
    build: (line: number) => FindingCandidate;
  }> = [
    {
      pattern: /\b(?:TODO|FIXME|HACK|XXX)\b/,
      build: (line) => ({
        kind: 'improvement',
        severity: 'Low',
        dimension: 'documentation',
        path: file.path,
        line,
        title: 'Unresolved maintenance marker',
        found: 'A TODO, FIXME, HACK, or XXX marker remains in source.',
        why: 'Without ownership or context, maintenance markers become invisible debt.',
        suggestion:
          'Resolve it or link it to a tracked issue that explains the constraint and intended outcome.',
      }),
    },
    {
      pattern: /\b(?:process\.env|os\.(?:getenv|environ)|System\.getenv)\b/,
      build: (line) => ({
        kind: 'strength',
        severity: 'Low',
        dimension: 'maintainability',
        path: file.path,
        line,
        title: 'Environment-driven configuration',
        found: 'Runtime configuration is read from the environment.',
        why: 'Environment-driven values keep deployments portable and reduce hardcoded configuration.',
        suggestion:
          'Keep required keys documented in an example environment file.',
      }),
    },
    {
      pattern:
        /\b(?:safeParse|parseAsync|validate|validationResult)\s*\(|\b(?:z|yup|joi)\.(?:object|string|number)\s*\(|\bBaseModel\b/,
      build: (line) => ({
        kind: 'strength',
        severity: 'Low',
        dimension: 'error-handling',
        path: file.path,
        line,
        title: 'Input validation at a boundary',
        found:
          'The code validates input using an explicit schema or validation step.',
        why: 'Boundary validation prevents malformed data from reaching core logic.',
        suggestion: 'Keep validation close to each external input boundary.',
      }),
    },
    {
      pattern: /\b(?:any|Any)\b/,
      build: (line) => ({
        kind: 'improvement',
        severity: 'Medium',
        dimension: 'maintainability',
        path: file.path,
        line,
        title: 'Broad type bypass',
        found: 'A broad any/Any type bypasses useful structural checks.',
        why: 'Broad types move errors from development time into runtime and obscure the expected data shape.',
        suggestion:
          'Define the smallest interface or generic constraint that represents the values used here.',
        example: 'type ApiResult = { id: string; status: "ready" | "failed" };',
      }),
    },
    {
      pattern:
        /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"\n]{8,}/i,
      build: (line) => ({
        kind: 'improvement',
        severity: 'High',
        dimension: 'maintainability',
        path: file.path,
        line,
        title: 'Possible hardcoded credential',
        found:
          'A credential-like value appears to be assigned directly in source. The value is never displayed.',
        why: 'Committed credentials can leak access and remain recoverable from Git history.',
        suggestion:
          'Move the value to environment configuration and rotate it if it was ever valid.',
      }),
    },
    {
      pattern: /\b(?:dangerouslySetInnerHTML|eval\s*\(|new\s+Function\s*\()/,
      build: (line) => ({
        kind: 'improvement',
        severity: 'High',
        dimension: 'maintainability',
        path: file.path,
        line,
        title: 'Unsafe dynamic execution or HTML escape hatch',
        found:
          'The code uses an API that bypasses normal escaping or executes dynamic text.',
        why: 'Untrusted values reaching this API can create injection vulnerabilities.',
        suggestion:
          'Prefer structured rendering. If the escape hatch is required, sanitize at the boundary and document the trust assumption.',
      }),
    },
    {
      pattern: /\bif\s*\(\s*false\s*\)|\bif\s+False\s*:|^\s*#if\s+0\b/,
      build: (line) => ({
        kind: 'improvement',
        severity: 'Low',
        dimension: 'maintainability',
        path: file.path,
        line,
        title: 'Statically disabled code path',
        found: 'A branch is guarded by a literal false condition and cannot run as written.',
        why: 'Dead branches add maintenance cost and make readers question whether unfinished behavior is still required.',
        suggestion:
          'Remove the branch, or replace it with a named feature flag if the behavior is intentionally configurable.',
      }),
    },
    {
      pattern: /\b(?:transaction|beginTransaction|withTransaction)\s*\(/i,
      build: (line) => ({
        kind: 'strength',
        severity: 'Low',
        dimension: 'maintainability',
        path: file.path,
        line,
        title: 'Explicit database transaction boundary',
        found:
          'Related database operations are grouped in an explicit transaction.',
        why: 'Transaction boundaries protect consistency when one part of a multi-step write fails.',
        suggestion:
          'Keep the transaction focused and ensure failures roll back with useful context.',
      }),
    },
  ];

  for (const check of checks) {
    const index = lines.findIndex((line) => check.pattern.test(line));
    if (index >= 0) findings.push(check.build(index + 1));
  }

  const emptyCatchIndex = lines.findIndex((line, index) => {
    if (!/\bcatch\s*(?:\([^)]*\))?\s*\{/.test(line)) return false;
    return /^\s*}\s*$/.test(lines[index + 1] ?? '');
  });
  if (emptyCatchIndex >= 0) {
    findings.push({
      kind: 'improvement',
      severity: 'High',
      dimension: 'error-handling',
      path: file.path,
      line: emptyCatchIndex + 1,
      endLine: emptyCatchIndex + 2,
      title: 'Silenced error',
      found:
        'An empty catch block discards a failure without handling or reporting it.',
      why: 'Silent failures make defects difficult to diagnose and can leave state partially updated.',
      suggestion:
        'Handle the expected failure explicitly, or rethrow it with operation context. Avoid logging sensitive inputs.',
    });
  } else {
    const errorPathIndex = lines.findIndex((line) =>
      /\b(?:catch\s*\(|except\s+\w+|if\s+err\s*!=\s*nil)/.test(line),
    );
    if (errorPathIndex >= 0) {
      findings.push({
        kind: 'strength',
        severity: 'Low',
        dimension: 'error-handling',
        path: file.path,
        line: errorPathIndex + 1,
        title: 'Explicit failure path',
        found: 'The implementation handles a failure path explicitly.',
        why: 'Explicit error paths make failure behaviour visible and debuggable.',
        suggestion:
          'Preserve useful context when propagating or translating the error.',
      });
    }
  }

  const sqlInterpolation = lines.findIndex((line) =>
    /(?:SELECT|INSERT|UPDATE|DELETE).*(?:\$\{|\+\s*\w+|f['"])/i.test(line),
  );
  if (sqlInterpolation >= 0) {
    findings.push({
      kind: 'improvement',
      severity: 'High',
      dimension: 'error-handling',
      path: file.path,
      line: sqlInterpolation + 1,
      title: 'Possible interpolated SQL',
      found:
        'A SQL statement appears to include a dynamically interpolated value.',
      why: 'String-built SQL can allow injection and makes query planning less reliable.',
      suggestion:
        'Use the database client’s parameter placeholders and pass values separately.',
    });
  }

  const hardcodedEndpoint = lines.findIndex((line) =>
    /['"]https?:\/\/(?:localhost|127\.0\.0\.1|api\.)[^'"]+['"]/.test(line),
  );
  if (hardcodedEndpoint >= 0) {
    findings.push({
      kind: 'improvement',
      severity: 'Low',
      dimension: 'maintainability',
      path: file.path,
      line: hardcodedEndpoint + 1,
      title: 'Hardcoded service endpoint',
      found: 'A service URL is embedded directly in implementation code.',
      why: 'Environment-specific endpoints make local, test, and deployed environments harder to configure safely.',
      suggestion:
        'Move the base URL into validated configuration while keeping stable route paths near the request code.',
    });
  }

  const apiRouteIndex = lines.findIndex((line) =>
    /\b(?:app|router)\.(?:post|put|patch)\s*\(/.test(line),
  );
  if (apiRouteIndex >= 0) {
    const routeBody = lines.slice(apiRouteIndex, apiRouteIndex + 20).join('\n');
    if (
      !/\b(?:safeParse|parse|validate|schema|validationResult)\b/.test(
        routeBody,
      )
    ) {
      findings.push({
        kind: 'improvement',
        severity: 'High',
        dimension: 'error-handling',
        path: file.path,
        line: apiRouteIndex + 1,
        endLine: Math.min(lines.length, apiRouteIndex + 12),
        title: 'API mutation lacks nearby input validation',
        found:
          'A mutating route was detected without a nearby validation step in the sampled handler.',
        why: 'API boundaries should reject malformed input before it reaches business logic or persistence.',
        suggestion:
          'Parse the request with a schema at the route boundary and return a specific client error for invalid input.',
      });
    }
  }

  const typedBoundaryIndex = lines.findIndex((line) =>
    /^(?:export\s+)?(?:interface|type)\s+[A-Z][\w$]*/.test(line.trim()),
  );
  if (typedBoundaryIndex >= 0) {
    findings.push({
      kind: 'strength',
      severity: 'Low',
      dimension: 'maintainability',
      path: file.path,
      line: typedBoundaryIndex + 1,
      title: 'Explicit data contract',
      found:
        'The module defines a named type or interface for a data boundary.',
      why: 'Named contracts make assumptions visible to callers and allow tools to catch incompatible changes.',
      suggestion:
        'Keep contracts narrow and validate external runtime data before treating it as this type.',
    });
  }

  const fetchIndex = lines.findIndex((line) => /\bfetch\s*\(/.test(line));
  if (fetchIndex >= 0) {
    const nearby = lines.slice(fetchIndex, fetchIndex + 12).join('\n');
    if (!/\.ok\b|\.status\b|raise_for_status|ensure_success/i.test(nearby)) {
      findings.push({
        kind: 'improvement',
        severity: 'High',
        dimension: 'error-handling',
        path: file.path,
        line: fetchIndex + 1,
        endLine: Math.min(lines.length, fetchIndex + 12),
        title: 'HTTP response is not validated nearby',
        found:
          'A fetch call was detected without a nearby status or response.ok check.',
        why: 'fetch resolves for HTTP errors, so parsing immediately can turn a clear upstream failure into misleading downstream behaviour.',
        suggestion:
          'Validate the response before parsing and throw an error that retains operation context.',
        example:
          'const response = await fetch(url);\nif (!response.ok) throw new Error(`Request failed: ${response.status}`);',
      });
    }
  }

  const comments = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^\s*(?:\/\/|#|\/\*|\*)/.test(line));
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0).length;
  if (nonEmptyLines >= 30 && comments.length / nonEmptyLines > 0.4) {
    const first = comments[0];
    if (first) {
      findings.push({
        kind: 'improvement',
        severity: 'Low',
        dimension: 'documentation',
        path: file.path,
        line: first.index + 1,
        title: 'Comment-heavy implementation',
        found: `${Math.round((comments.length / nonEmptyLines) * 100)}% of non-empty lines are comment lines.`,
        why: 'Comments that narrate obvious syntax add reading cost and can drift away from the code.',
        suggestion:
          'Keep comments that explain intent, constraints, or unusual decisions; replace narration with clearer names and smaller functions.',
      });
    }
  }
  const complex = functionRanges.find(
    (range) => range.endLine - range.startLine >= 35,
  );
  if (complex) {
    const preceding = lines
      .slice(Math.max(0, complex.startLine - 4), complex.startLine - 1)
      .join('\n');
    if (!/(?:\/\/|#|\/\*|\*)/.test(preceding)) {
      findings.push({
        kind: 'improvement',
        severity: 'Medium',
        dimension: 'documentation',
        path: file.path,
        line: complex.startLine,
        endLine: Math.min(complex.endLine, complex.startLine + 10),
        title: 'Complex logic lacks decision context',
        found: `${complex.name} contains a substantial block of logic without a nearby explanatory comment.`,
        why: 'A short comment can preserve why the algorithm or business rule is structured this way without narrating obvious syntax.',
        suggestion:
          'Add one comment above the non-obvious decision explaining its constraint or rationale—not what each line does.',
      });
    } else {
      findings.push({
        kind: 'strength',
        severity: 'Low',
        dimension: 'documentation',
        path: file.path,
        line: Math.max(1, complex.startLine - 2),
        endLine: Math.min(complex.endLine, complex.startLine + 4),
        title: 'Helpful context around complex logic',
        found: 'A non-trivial function has nearby explanatory documentation.',
        why: 'Decision-focused comments reduce the time needed to understand unusual logic.',
        suggestion:
          'Keep comments focused on intent and constraints as the implementation changes.',
      });
    }
  } else if (comments.length > 0) {
    const first = comments[0];
    if (first) {
      findings.push({
        kind: 'strength',
        severity: 'Low',
        dimension: 'documentation',
        path: file.path,
        line: first.index + 1,
        title: 'Source documentation is present',
        found:
          'The file includes comments or documentation alongside implementation.',
        why: 'Selective documentation helps readers recover intent when it adds context beyond the syntax.',
        suggestion:
          'Keep comments accurate and reserve them for decisions or constraints.',
      });
    }
  }

  return findings;
}

function findFunctions(
  lines: string[],
  language: string,
): Array<{ name: string; startLine: number; endLine: number }> {
  const starts: Array<{ name: string; start: number; indent: number }> = [];
  const pattern =
    language === 'py'
      ? /^\s*(?:async\s+)?def\s+([A-Za-z_$][\w$]*)\s*\(/
      : /(?:function\s+|(?:const|let|var)\s+)([A-Za-z_$][\w$]*)[^=]*?(?:\([^)]*\)\s*(?:=>)?|=\s*(?:async\s*)?\([^)]*\)\s*=>)|(?:public\s+|private\s+|protected\s+|async\s+|static\s+)*([A-Za-z_$][\w$]*)\s*\([^;]*\)\s*\{/;
  lines.forEach((line, index) => {
    const match = line.match(pattern);
    const name = match?.[1] ?? match?.[2];
    if (name) starts.push({ name, start: index, indent: line.search(/\S|$/) });
  });
  return starts.map((start, index) => {
    const next = starts[index + 1];
    let end = Math.min(
      lines.length - 1,
      next ? next.start - 1 : start.start + 160,
    );
    if (language === 'py') {
      for (let cursor = start.start + 1; cursor < end; cursor += 1) {
        const line = lines[cursor] ?? '';
        if (line.trim() && line.search(/\S/) <= start.indent) {
          end = cursor - 1;
          break;
        }
      }
    } else {
      let depth = 0;
      let opened = false;
      for (let cursor = start.start; cursor <= end; cursor += 1) {
        const line = lines[cursor] ?? '';
        depth += (line.match(/\{/g) ?? []).length;
        if (depth > 0) opened = true;
        depth -= (line.match(/\}/g) ?? []).length;
        if (opened && depth <= 0) {
          end = cursor;
          break;
        }
      }
    }
    return { name: start.name, startLine: start.start + 1, endLine: end + 1 };
  });
}

function findDuplication(files: RepositoryFileEvidence[]): FindingCandidate[] {
  const blocks = new Map<string, Array<{ path: string; line: number }>>();
  for (const file of files) {
    const lines = file.content.split('\n');
    for (let index = 0; index <= lines.length - 6; index += 1) {
      const slice = lines.slice(index, index + 6);
      if (slice.some((line) => line.trim().length < 8)) continue;
      const normalized = slice
        .map((line) => line.trim().replace(/['"`][^'"`]+['"`]/g, 'VALUE'))
        .join('\n');
      const entries = blocks.get(normalized) ?? [];
      entries.push({ path: file.path, line: index + 1 });
      blocks.set(normalized, entries);
    }
  }
  const duplicate = [...blocks.values()].find(
    (entries) => new Set(entries.map((entry) => entry.path)).size >= 2,
  );
  if (!duplicate) return [];
  const first = duplicate[0];
  const other = duplicate.find((entry) => entry.path !== first?.path);
  if (!first || !other) return [];
  return [
    {
      kind: 'improvement',
      severity: 'Medium',
      dimension: 'maintainability',
      path: first.path,
      line: first.line,
      endLine: first.line + 5,
      title: 'Repeated implementation block',
      found: `A six-line implementation block also appears in ${other.path}:${other.line}.`,
      why: 'Duplicated behavior can drift when one copy changes without the other.',
      suggestion:
        'Extract the shared behavior only if both copies represent the same concept, then name the helper after that responsibility.',
    },
  ];
}

function materializeFinding(
  repository: GitHubRepository,
  files: RepositoryFileEvidence[],
  candidate: FindingCandidate,
  index: number,
): CodeQualityFinding {
  const file = files.find((entry) => entry.path === candidate.path);
  const lines = file?.content.split('\n') ?? [];
  const originalLineBase = file?.startLine ?? 1;
  const localLine = Math.max(1, candidate.line);
  const localEnd = Math.max(localLine, candidate.endLine ?? localLine);
  const start = Math.max(1, localLine - 2);
  const requestedEnd = candidate.endLine
    ? Math.min(localEnd, localLine + 10)
    : localLine + 3;
  const end = Math.min(lines.length || requestedEnd, requestedEnd);
  const startLine = originalLineBase + start - 1;
  const endLine = originalLineBase + end - 1;
  const ref = file?.ref ?? repository.defaultBranch;
  return {
    id: `quality-${index}-${slug(candidate.title)}`,
    kind: candidate.kind,
    severity: candidate.severity,
    dimension: candidate.dimension,
    path: candidate.path,
    startLine,
    endLine,
    matchOffset: originalLineBase + localLine - 1 - startLine + 1,
    language: languageName(candidate.path),
    fragment: lines.slice(start - 1, end).join('\n'),
    title: candidate.title,
    found: candidate.found,
    why: candidate.why,
    suggestion: candidate.suggestion,
    example: candidate.example,
    githubUrl: `${repository.htmlUrl}/blob/${ref}/${candidate.path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}#L${startLine}-L${endLine}`,
  };
}

function buildDimensions(
  files: RepositoryFileEvidence[],
  findings: CodeQualityFinding[],
): CodeQualityDimension[] {
  const keys = Object.keys(dimensionLabels) as CodeQualityDimensionKey[];
  return keys.map((key) => {
    const relevant = findings.filter((finding) => finding.dimension === key);
    const strengths = relevant.filter((finding) => finding.kind === 'strength');
    const improvements = relevant.filter(
      (finding) => finding.kind === 'improvement',
    );
    const penalty = improvements.reduce(
      (sum, finding) =>
        sum +
        (finding.severity === 'High'
          ? 2
          : finding.severity === 'Medium'
            ? 1.1
            : 0.5),
      0,
    );
    const evidenceBase = files.length > 0 ? 6 : 0;
    const score = round1(
      Math.max(
        1,
        Math.min(10, evidenceBase + strengths.length * 0.8 - penalty),
      ),
    );
    return {
      key,
      label: dimensionLabels[key],
      score,
      summary:
        relevant.length === 0
          ? 'No reliable positive or negative signal was detected in the sampled source.'
          : `${strengths.length} supported strength(s) and ${improvements.length} improvement finding(s) in sampled source.`,
      findingIds: relevant.map((finding) => finding.id),
    };
  });
}

function isWeakCommitMessage(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .replace(/[.!]+$/, '')
    .trim();
  return (
    normalized.length < 8 ||
    /^(?:update|updates|fix|fixed|stuff|changes?|work|wip|test|testing|cleanup|misc|initial commit|final)$/.test(
      normalized,
    ) ||
    /^(?:update|fix|change|edit)\s+(?:code|files?|stuff|things?)$/.test(
      normalized,
    )
  );
}

function compareCandidates(a: FindingCandidate, b: FindingCandidate): number {
  const kind = a.kind === b.kind ? 0 : a.kind === 'improvement' ? -1 : 1;
  const severity = { High: 0, Medium: 1, Low: 2 };
  return (
    kind ||
    severity[a.severity] - severity[b.severity] ||
    a.path.localeCompare(b.path)
  );
}

function extension(path: string): string {
  return path.split('.').at(-1)?.toLowerCase() ?? '';
}

function languageName(path: string): string {
  const names: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    go: 'go',
    java: 'java',
    rs: 'rust',
    cs: 'csharp',
    sql: 'sql',
  };
  return names[extension(path)] ?? (extension(path) || 'text');
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
