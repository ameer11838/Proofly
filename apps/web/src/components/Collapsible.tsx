import type { ReactNode } from 'react';

interface CollapsibleProps {
  title: string;
  summary?: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Native disclosure so detailed evidence stays available without cluttering the page,
 * and keyboard/screen-reader behaviour comes for free.
 */
export function Collapsible({
  title,
  summary,
  badge,
  defaultOpen = false,
  children,
}: CollapsibleProps) {
  return (
    <details
      className="group my-3 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-subtle)] transition-colors open:border-[var(--border-strong)] open:bg-[var(--surface)]"
      open={defaultOpen}
    >
      <summary className="focus-control flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none transition hover:bg-[var(--surface-raised)]">
        <span className="flex min-w-0 flex-col">
          <span className="text-base font-bold text-[var(--text)] group-hover:text-[var(--accent)]">
            {title}
          </span>
          {summary ? (
            <span className="mt-0.5 text-sm leading-5 text-[var(--muted)]">
              {summary}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {badge}
          <svg
            className="size-5 text-[var(--muted)] transition-transform duration-200 group-open:rotate-180 group-hover:text-[var(--accent)]"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </summary>
      <div className="border-t border-[var(--border)] px-4 py-4">
        {children}
      </div>
    </details>
  );
}
