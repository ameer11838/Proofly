import { tokenClassNames, tokenizeLine } from '../lib/highlight.js';

interface CodeFragmentProps {
  fragment: string;
  language: string;
  startLine: number;
  /** 1-indexed line within the fragment that triggered the detection. */
  matchOffset: number;
}

/**
 * Renders lines exactly as they were downloaded from the repository. Tokens are rendered
 * as React elements rather than injected HTML, so repository content can never execute.
 */
export function CodeFragment({
  fragment,
  language,
  startLine,
  matchOffset,
}: CodeFragmentProps) {
  const lines = fragment.split('\n');

  return (
    // Deliberately dark in both themes: a code surface reads as code. The ring gives it an
    // edge against the light card and against the dark page background alike.
    <div className="overflow-x-auto rounded-2xl bg-slate-950 py-3 text-[13px] leading-6 ring-1 ring-slate-800 dark:ring-slate-700">
      <pre className="min-w-max font-mono">
        <code>
          {lines.map((line, index) => {
            const lineNumber = startLine + index;
            const isMatch = index + 1 === matchOffset;

            return (
              <div
                key={lineNumber}
                className={`flex gap-4 px-3 ${isMatch ? 'bg-aurora/20 ring-1 ring-inset ring-aurora/40' : ''}`}
              >
                <span
                  className={`w-10 shrink-0 select-none text-right ${
                    isMatch ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {lineNumber}
                </span>
                <span className="whitespace-pre">
                  {line.length === 0 ? (
                    <span> </span>
                  ) : (
                    tokenizeLine(line, language).map((token, tokenIndex) => (
                      <span
                        key={`${lineNumber}-${tokenIndex}`}
                        className={tokenClassNames[token.type]}
                      >
                        {token.value}
                      </span>
                    ))
                  )}
                </span>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
