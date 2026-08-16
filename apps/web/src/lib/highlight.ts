export type TokenType =
  'comment' | 'string' | 'number' | 'keyword' | 'call' | 'plain';

export interface Token {
  type: TokenType;
  value: string;
}

const sharedKeywords = [
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'else',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'public',
  'return',
  'static',
  'struct',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'var',
  'void',
  'while',
  'yield',
];

const keywordsByLanguage: Record<string, string[]> = {
  python: [
    'def',
    'elif',
    'except',
    'lambda',
    'None',
    'True',
    'False',
    'self',
    'with',
    'raise',
    'and',
    'or',
    'not',
    'is',
    'pass',
    'global',
  ],
  go: ['func', 'defer', 'chan', 'go', 'range', 'nil', 'map', 'select'],
  rust: [
    'fn',
    'let',
    'mut',
    'impl',
    'trait',
    'match',
    'pub',
    'use',
    'crate',
    'Some',
    'None',
    'Ok',
    'Err',
  ],
  java: ['final', 'abstract', 'extends', 'super', 'synchronized', 'protected'],
  csharp: ['namespace', 'using', 'override', 'readonly', 'sealed'],
  cpp: [
    'include',
    'template',
    'namespace',
    'nullptr',
    'const',
    'auto',
    'virtual',
    'std',
  ],
  c: ['include', 'sizeof', 'unsigned', 'static'],
  sql: [
    'select',
    'from',
    'where',
    'join',
    'left',
    'inner',
    'outer',
    'group',
    'order',
    'by',
    'insert',
    'into',
    'values',
    'update',
    'set',
    'delete',
    'create',
    'table',
    'index',
    'on',
    'and',
    'or',
    'not',
    'null',
    'as',
    'with',
    'partition',
    'over',
    'distinct',
    'limit',
  ],
  yaml: ['true', 'false', 'null'],
  docker: [
    'from',
    'run',
    'copy',
    'cmd',
    'entrypoint',
    'workdir',
    'env',
    'expose',
    'arg',
  ],
  hcl: ['resource', 'provider', 'variable', 'module', 'output', 'data'],
  bash: ['if', 'then', 'fi', 'for', 'do', 'done', 'echo', 'export', 'local'],
  r: [
    'function',
    'if',
    'else',
    'for',
    'while',
    'return',
    'library',
    'true',
    'false',
    'null',
  ],
};

const lineCommentByLanguage: Record<string, string[]> = {
  python: ['#'],
  yaml: ['#'],
  toml: ['#'],
  bash: ['#'],
  docker: ['#'],
  r: ['#'],
  hcl: ['#', '//'],
  sql: ['--'],
  markdown: [],
};

const defaultLineComments = ['//'];

/**
 * Tokenizes a single line for display. Fragments are short and already extracted, so a
 * line-scoped tokenizer is enough — this never needs to parse a whole file.
 */
export function tokenizeLine(line: string, language: string): Token[] {
  const keywords = new Set(
    [...sharedKeywords, ...(keywordsByLanguage[language] ?? [])].map(
      (keyword) => keyword.toLowerCase(),
    ),
  );
  const commentPrefixes =
    lineCommentByLanguage[language] ?? defaultLineComments;
  const tokens: Token[] = [];
  let index = 0;
  let plain = '';

  const flush = () => {
    if (plain.length > 0) {
      tokens.push({ type: 'plain', value: plain });
      plain = '';
    }
  };

  while (index < line.length) {
    const rest = line.slice(index);

    const commentPrefix = commentPrefixes.find((prefix) =>
      rest.startsWith(prefix),
    );
    if (commentPrefix || rest.startsWith('/*')) {
      flush();
      tokens.push({ type: 'comment', value: rest });
      return tokens;
    }

    const stringMatch =
      /^(?:"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)/.exec(
        rest,
      );
    if (stringMatch) {
      flush();
      tokens.push({ type: 'string', value: stringMatch[0] });
      index += stringMatch[0].length;
      continue;
    }

    const numberMatch = /^\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(rest);
    if (numberMatch && !/[\w$]/.test(line[index - 1] ?? '')) {
      flush();
      tokens.push({ type: 'number', value: numberMatch[0] });
      index += numberMatch[0].length;
      continue;
    }

    const wordMatch = /^[A-Za-z_$@][\w$]*/.exec(rest);
    if (wordMatch) {
      const word = wordMatch[0];
      flush();

      if (keywords.has(word.toLowerCase())) {
        tokens.push({ type: 'keyword', value: word });
      } else if (/^\s*\(/.test(rest.slice(word.length))) {
        tokens.push({ type: 'call', value: word });
      } else {
        tokens.push({ type: 'plain', value: word });
      }

      index += word.length;
      continue;
    }

    plain += line[index];
    index += 1;
  }

  flush();
  return tokens;
}

export const tokenClassNames: Record<TokenType, string> = {
  comment: 'text-slate-500 italic',
  string: 'text-emerald-300',
  number: 'text-amber-300',
  keyword: 'text-violet-300',
  call: 'text-sky-300',
  plain: 'text-slate-200',
};
