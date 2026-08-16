import type { RepositoryFileEvidence } from './codeEvidence.js';

export interface DependencyRecord {
  /** Lowercase dependency name as declared in the manifest. */
  name: string;
  /** Manifest the dependency was declared in. */
  path: string;
}

const manifestNames = [
  'package.json',
  'requirements.txt',
  'requirements-dev.txt',
  'pyproject.toml',
  'pipfile',
  'cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'gemfile',
  'composer.json',
];

export function isManifestPath(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return manifestNames.some(
    (name) => lowerPath === name || lowerPath.endsWith(`/${name}`),
  );
}

/**
 * Reads declared dependencies out of the manifests that were actually downloaded.
 * Anything that cannot be parsed is skipped rather than guessed at.
 */
export function extractDependencies(
  files: RepositoryFileEvidence[],
): DependencyRecord[] {
  const records: DependencyRecord[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    if (!isManifestPath(file.path)) {
      continue;
    }

    for (const name of parseManifest(file)) {
      const key = `${file.path}:${name}`;
      if (name.length > 0 && !seen.has(key)) {
        seen.add(key);
        records.push({ name, path: file.path });
      }
    }
  }

  return records;
}

function parseManifest(file: RepositoryFileEvidence): string[] {
  const lowerPath = file.path.toLowerCase();

  if (
    lowerPath.endsWith('package.json') ||
    lowerPath.endsWith('composer.json')
  ) {
    return parseJsonManifest(file.content);
  }

  if (
    lowerPath.endsWith('requirements.txt') ||
    lowerPath.endsWith('requirements-dev.txt')
  ) {
    return parseRequirements(file.content);
  }

  if (
    lowerPath.endsWith('pyproject.toml') ||
    lowerPath.endsWith('cargo.toml') ||
    lowerPath.endsWith('pipfile')
  ) {
    return parseTomlManifest(file.content);
  }

  if (lowerPath.endsWith('go.mod')) {
    return parseGoMod(file.content);
  }

  if (lowerPath.endsWith('pom.xml')) {
    return matchAll(file.content, /<artifactId>\s*([^<\s]+)\s*<\/artifactId>/g);
  }

  if (
    lowerPath.endsWith('build.gradle') ||
    lowerPath.endsWith('build.gradle.kts')
  ) {
    return matchAll(
      file.content,
      /(?:implementation|api|testImplementation)\s*\(?['"]([^'"]+)['"]/g,
    ).map((entry) => entry.split(':')[1] ?? entry);
  }

  if (lowerPath.endsWith('gemfile')) {
    return matchAll(file.content, /^\s*gem\s+['"]([^'"]+)['"]/gm);
  }

  return [];
}

function parseJsonManifest(content: string): string[] {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const sections = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'require',
      'require-dev',
    ];

    return sections
      .flatMap((section) => {
        const value = parsed[section];
        return value && typeof value === 'object'
          ? Object.keys(value as object)
          : [];
      })
      .map(normalize);
  } catch {
    return [];
  }
}

function parseRequirements(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 && !line.startsWith('#') && !line.startsWith('-'),
    )
    .map((line) => line.split(/[<>=!~[\s;]/)[0] ?? '')
    .map(normalize);
}

function parseTomlManifest(content: string): string[] {
  const names: string[] = [];
  let inDependencyBlock = false;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (line.startsWith('[')) {
      inDependencyBlock = /dependencies|packages/i.test(line);
      continue;
    }

    if (inDependencyBlock) {
      const keyMatch = /^([A-Za-z0-9._-]+)\s*=/.exec(line);
      if (keyMatch?.[1]) {
        names.push(normalize(keyMatch[1]));
      }
      continue;
    }

    // PEP 621 style: dependencies = ["numpy>=1.24", "pandas"]
    const inlineMatch = /^["']([A-Za-z0-9._-]+)/.exec(line);
    if (inlineMatch?.[1] && /^\s*["']/.test(rawLine)) {
      names.push(normalize(inlineMatch[1]));
    }
  }

  return names;
}

function parseGoMod(content: string): string[] {
  return matchAll(
    content,
    /^\s*(?:require\s+)?([a-z0-9.\-/]+\.[a-z]{2,}\/[^\s]+)\s+v/gm,
  ).flatMap((module) => {
    const segments = module.split('/');
    return [normalize(module), normalize(segments.at(-1) ?? module)];
  });
}

function matchAll(content: string, pattern: RegExp): string[] {
  return [...content.matchAll(pattern)].map((match) =>
    normalize(match[1] ?? ''),
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Matches a declared dependency against a skill's expected dependency, allowing for
 * scoped and suffixed package names such as `@aws-sdk/client-s3` for `aws-sdk`.
 */
export function dependencyMatches(declared: string, expected: string): boolean {
  if (declared === expected) {
    return true;
  }

  // Short names such as `pg` or `r` would match far too much as substrings.
  if (declared.length < 4 || expected.length < 4) {
    return false;
  }

  return declared.includes(expected) || expected.includes(declared);
}
