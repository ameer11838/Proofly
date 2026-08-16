import type {
  CodeEvidence,
  GitHubRepository,
  ScoreCategoryKey,
} from '@proofly/shared-types';
import type { CareerSkill, CodeSignal } from './careerSkillMap.js';

export interface RepositoryFileEvidence {
  path: string;
  size: number;
  content: string;
  /** Git ref containing these exact lines; defaults to the repository default branch. */
  ref?: string;
  /** Original 1-indexed line number of content[0], used for diff-derived evidence. */
  startLine?: number;
  /** Distinguishes multiple contributed hunks from the same path. */
  evidenceId?: string;
}

const contextLinesBefore = 2;
const contextLinesAfter = 4;
const maxLineLength = 220;
const maxEvidencePerSkill = 2;
const maxEvidenceTotal = 14;
/** Files whose average line length is above this are treated as generated or minified. */
const minifiedAverageLineLength = 400;

interface SignalOwner {
  skillId: string;
  skillLabel: string;
  category: ScoreCategoryKey;
  scoreImpact: string;
}

interface CandidateMatch {
  owner: SignalOwner;
  signal: CodeSignal;
  file: RepositoryFileEvidence;
  lineIndex: number;
}

/**
 * Engineering-quality signals. These sit outside the career skill map because they
 * support the engineering categories rather than career relevance.
 */
const engineeringSignalGroups: { owner: SignalOwner; signals: CodeSignal[] }[] =
  [
    {
      owner: {
        skillId: 'testing',
        skillLabel: 'Automated testing',
        category: 'testing',
        scoreImpact: 'Counts toward the Testing category.',
      },
      signals: [
        {
          pattern:
            /\b(?:expect|assert)\s*\(|\bassert\s+\w+|\bshould\s*\.\s*\w+/,
          files:
            /(\.test\.|\.spec\.|(^|\/)(tests?|__tests__)\/|(^|\/)test_\w+\.py$)/,
          detected: 'Assertion inside a test',
          why: 'Assertions prove the test checks behaviour instead of only running code.',
        },
        {
          pattern: /\b(?:mock|stub|spy|fixture|beforeEach|setUp)\b/,
          files: /(\.test\.|\.spec\.|(^|\/)(tests?|__tests__)\/)/,
          detected: 'Test isolation setup',
          why: 'Mocks and fixtures show tests are designed to be deterministic.',
        },
      ],
    },
    {
      owner: {
        skillId: 'ci-pipeline',
        skillLabel: 'CI/CD automation',
        category: 'ci-automation',
        scoreImpact: 'Counts toward the CI/CD and automation category.',
      },
      signals: [
        {
          pattern: /^\s*(?:run|uses)\s*:\s*\S/,
          files: /^\.github\/workflows\/|\.gitlab-ci\.ya?ml$/,
          detected: 'Automated pipeline step',
          why: 'Shows which checks actually run on every push, not just that a config exists.',
        },
      ],
    },
    {
      owner: {
        skillId: 'error-handling',
        skillLabel: 'Error handling',
        category: 'code-structure',
        scoreImpact: 'Counts toward the Code structure category.',
      },
      signals: [
        {
          pattern:
            /\bcatch\s*\(\s*\w+|\bexcept\s+\w*(?:Error|Exception)|\bif\s+err\s*!=\s*nil\b/,
          detected: 'Explicit failure path',
          why: 'Handling errors deliberately is a production-readiness signal.',
        },
        {
          pattern:
            /\bthrow\s+new\s+\w*Error\s*\(|\braise\s+\w*(?:Error|Exception)\s*\(/,
          detected: 'Domain error raised with context',
          why: 'Typed, described errors make failures debuggable by other engineers.',
        },
      ],
    },
    {
      owner: {
        skillId: 'input-validation',
        skillLabel: 'Input validation',
        category: 'code-structure',
        scoreImpact: 'Counts toward the Code structure category.',
      },
      signals: [
        {
          pattern:
            /\b(?:z|yup|joi|schema)\s*\.\s*(?:object|string|number)\s*\(|\bsafeParse\s*\(|\bBaseModel\b/,
          detected: 'Schema-based input validation',
          why: 'Validating untrusted input at the boundary prevents a whole class of defects.',
        },
      ],
    },
    {
      owner: {
        skillId: 'configuration',
        skillLabel: 'Configuration management',
        category: 'project-completeness',
        scoreImpact: 'Counts toward the Project completeness category.',
      },
      signals: [
        {
          pattern:
            /\bprocess\.env\.\w+|\bos\.(?:environ|getenv)\b|\bSystem\.getenv\b/,
          detected: 'Environment-driven configuration',
          why: 'Reading config from the environment keeps deployments portable and secrets out of code.',
        },
      ],
    },
  ];

export function extractCodeEvidence(
  repository: GitHubRepository,
  files: RepositoryFileEvidence[],
  skills: CareerSkill[],
  careerCategoryMax: number,
): CodeEvidence[] {
  // Manifests are excluded: a declared dependency is reported as a dependency signal,
  // and quoting a requirements.txt line as "code evidence" would overstate it.
  const usableFiles = files.filter(
    (file) => !isGeneratedFile(file) && !isManifestFile(file.path),
  );
  const owners: { owner: SignalOwner; signals: CodeSignal[] }[] = [
    ...skills
      .filter((skill) => (skill.codeSignals?.length ?? 0) > 0)
      .map((skill) => ({
        owner: {
          skillId: skill.id,
          skillLabel: skill.label,
          category: 'career-relevance' as ScoreCategoryKey,
          scoreImpact: `Raises the ${skill.label} skill to strong evidence, which lifts the Career relevance category (worth up to ${careerCategoryMax.toFixed(1)} points).`,
        },
        signals: skill.codeSignals ?? [],
      })),
    ...engineeringSignalGroups,
  ];

  const matches: CandidateMatch[] = [];

  for (const { owner, signals } of owners) {
    let perSkill = 0;
    const seenPaths = new Set<string>();
    /**
     * Line ranges this skill already quoted. Deliberately per-skill: when two skills are
     * both demonstrated by the same lines, both should keep their evidence.
     */
    const claimedRanges: { start: number; end: number }[] = [];

    for (const signal of signals) {
      if (perSkill >= maxEvidencePerSkill) {
        break;
      }

      for (const file of usableFiles) {
        if (perSkill >= maxEvidencePerSkill) {
          break;
        }

        const fileKey = file.evidenceId ?? file.path;
        if (seenPaths.has(fileKey)) {
          continue;
        }

        if (signal.files) {
          if (!signal.files.test(file.path.toLowerCase())) {
            continue;
          }
        } else if (!isSourceFile(file.path)) {
          // Without an explicit file filter a signal only applies to source code. Otherwise
          // a README sentence or a CI install line would be quoted as if it were usage.
          continue;
        }

        const lineIndex = findMatchingLine(
          file.content,
          signal.pattern,
          claimedRanges,
        );
        if (lineIndex < 0) {
          continue;
        }

        matches.push({ owner, signal, file, lineIndex });
        claimedRanges.push({
          start: lineIndex - contextLinesBefore,
          end: lineIndex + contextLinesAfter,
        });
        seenPaths.add(fileKey);
        perSkill += 1;
      }
    }
  }

  return matches
    .slice(0, maxEvidenceTotal)
    .map((match, index) => toCodeEvidence(repository, match, index));
}

function toCodeEvidence(
  repository: GitHubRepository,
  match: CandidateMatch,
  index: number,
): CodeEvidence {
  const lines = match.file.content.split('\n');
  let start = Math.max(0, match.lineIndex - contextLinesBefore);
  let end = Math.min(lines.length - 1, match.lineIndex + contextLinesAfter);

  // Blank edges waste vertical space and make the quoted range look wrong.
  while (start < match.lineIndex && (lines[start] ?? '').trim().length === 0) {
    start += 1;
  }
  while (end > match.lineIndex && (lines[end] ?? '').trim().length === 0) {
    end -= 1;
  }

  const slice = lines.slice(start, end + 1).map(clampLine);
  const dedented = dedent(slice);

  const lineBase = match.file.startLine ?? 1;
  const startLine = lineBase + start;
  const endLine = lineBase + end;

  return {
    id: `${match.owner.skillId}-${index}`,
    path: match.file.path,
    startLine,
    endLine,
    matchOffset: match.lineIndex - start + 1,
    language: languageForPath(match.file.path),
    fragment: dedented.join('\n'),
    detected: match.signal.detected,
    why: match.signal.why,
    skillId: match.owner.skillId,
    skillLabel: match.owner.skillLabel,
    category: match.owner.category,
    scoreImpact: match.owner.scoreImpact,
    githubUrl: `${repository.htmlUrl}/blob/${match.file.ref ?? repository.defaultBranch}/${match.file.path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}#L${startLine}-L${endLine}`,
    commitSha: match.file.ref,
  };
}

function findMatchingLine(
  content: string,
  pattern: RegExp,
  claimedRanges: { start: number; end: number }[],
): number {
  const lines = content.split('\n');
  const matcher = new RegExp(pattern.source, pattern.flags.replace('g', ''));

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (line.length > maxLineLength * 4 || isCommentOnly(line)) {
      continue;
    }

    if (
      claimedRanges.some((range) => index >= range.start && index <= range.end)
    ) {
      continue;
    }

    if (matcher.test(line)) {
      return index;
    }
  }

  return -1;
}

/** Comment lines are skipped so a mention of a technology is never quoted as usage of it. */
function isCommentOnly(line: string): boolean {
  return /^\s*(?:\/\/|#|\*|<!--|--\s)/.test(line);
}

function isSourceFile(path: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs|py|ipynb|go|java|rs|cs|cpp|cc|c|h|hpp|kt|swift|rb|scala|sql|r|sh|tf|hcl)$/.test(
    path.toLowerCase(),
  );
}

function isManifestFile(path: string): boolean {
  const name = path.toLowerCase().split('/').at(-1) ?? '';
  return [
    'package.json',
    'requirements.txt',
    'requirements-dev.txt',
    'pyproject.toml',
    'pipfile',
    'cargo.toml',
    'go.mod',
    'pom.xml',
    'build.gradle',
    'gemfile',
    'composer.json',
  ].includes(name);
}

function isGeneratedFile(file: RepositoryFileEvidence): boolean {
  const lowerPath = file.path.toLowerCase();

  if (
    /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|go\.sum)$/.test(
      lowerPath,
    )
  ) {
    return true;
  }

  if (/\.min\.(js|css)$/.test(lowerPath)) {
    return true;
  }

  const lines = file.content.split('\n');
  return (
    lines.length > 0 &&
    file.content.length / lines.length > minifiedAverageLineLength
  );
}

function clampLine(line: string): string {
  return line.length > maxLineLength
    ? `${line.slice(0, maxLineLength)}…`
    : line;
}

function dedent(lines: string[]): string[] {
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.length - line.trimStart().length);
  const shift = indents.length > 0 ? Math.min(...indents) : 0;

  return shift > 0 ? lines.map((line) => line.slice(shift)) : lines;
}

const languagesByExtension: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  ipynb: 'python',
  go: 'go',
  java: 'java',
  rs: 'rust',
  cs: 'csharp',
  cpp: 'cpp',
  cc: 'cpp',
  c: 'c',
  h: 'cpp',
  hpp: 'cpp',
  sql: 'sql',
  sh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  json: 'json',
  toml: 'toml',
  md: 'markdown',
  r: 'r',
};

export function languageForPath(path: string): string {
  const lowerPath = path.toLowerCase();

  if (/dockerfile/.test(lowerPath)) {
    return 'docker';
  }

  if (/\.tf$/.test(lowerPath)) {
    return 'hcl';
  }

  const extension = lowerPath.split('.').at(-1) ?? '';
  return languagesByExtension[extension] ?? 'text';
}
