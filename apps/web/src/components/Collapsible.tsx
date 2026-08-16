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
      className="group border-t border-slate-200/80 py-4 first:border-t-0 dark:border-slate-800"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-1 py-1 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-aurora dark:hover:bg-slate-800/60">
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </span>
          {summary ? (
            <span className="truncate text-xs text-slate-500 dark:text-slate-400">
              {summary}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {badge}
          <svg
            className="size-4 text-slate-400 transition-transform group-open:rotate-180 dark:text-slate-500"
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
      <div className="mt-3 px-1">{children}</div>
    </details>
  );
}
