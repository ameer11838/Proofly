import type { FormEvent } from 'react';
import type { CareerPath } from '@proofly/shared-types';
import { CareerSelect } from './CareerSelect.js';

interface SearchToolbarProps {
  username: string;
  onUsernameChange: (username: string) => void;
  careerPath: CareerPath;
  onCareerPathChange: (careerPath: CareerPath) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export function SearchToolbar({
  username,
  onUsernameChange,
  careerPath,
  onCareerPathChange,
  onSubmit,
  isLoading,
}: SearchToolbarProps) {
  return (
    <form className="surface p-5" onSubmit={onSubmit}>
      {/* Full-width fields: side-by-side columns truncated longer career labels such as
          "DevOps and cloud engineering" at this card width. */}
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <label
            className="field-label font-medium text-[var(--text)]"
            htmlFor="github-username"
          >
            GitHub username
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">
              @
            </span>
            <input
              id="github-username"
              className="focus-control w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] py-2 pl-6 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] hover:border-[var(--border-strong)]"
              placeholder="octocat"
              autoComplete="off"
              spellCheck={false}
              value={username}
              onChange={(event) => onUsernameChange(event.target.value)}
            />
          </div>
        </div>

        <CareerSelect value={careerPath} onChange={onCareerPathChange} />
      </div>

      <button
        className="primary-action focus-control mt-5 h-9 w-full px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isLoading || username.trim().length === 0}
        type="submit"
      >
        {isLoading ? 'Reading…' : 'Rank repositories'}
      </button>

      <p className="mt-4 border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--muted)]">
        Only public repositories are read. On a fork, commits are checked across
        every branch first, and only the ones authored by that user count.
      </p>
    </form>
  );
}
