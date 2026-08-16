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
    <form className="surface p-5 sm:p-6" onSubmit={onSubmit}>
      <div className="mb-5 flex items-center justify-between border-b border-[var(--border)] pb-3">
        <p className="section-kicker">Analysis input</p>
        <span className="technical-label">Source / GitHub</span>
      </div>
      {/* Full-width fields: side-by-side columns truncated longer career labels such as
          "DevOps and cloud engineering" at this card width. */}
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <label
            className="technical-label font-semibold"
            htmlFor="github-username"
          >
            GitHub username
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-[var(--muted)]">
              @
            </span>
            <input
              id="github-username"
              className="focus-control w-full rounded-[7px] border border-[var(--border)] bg-[var(--surface-subtle)] py-3 pl-8 pr-4 font-mono text-sm font-medium text-[var(--text)] outline-none transition placeholder:font-normal placeholder:text-[var(--muted)] hover:border-[var(--border-strong)]"
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
        className="primary-action focus-control mt-4 h-12 w-full px-7 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isLoading || username.trim().length === 0}
        type="submit"
      >
        {isLoading ? 'Reading GitHub…' : 'Rank repositories'}
      </button>

      <p className="mt-4 border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--muted)]">
        Ranking reads public repository metadata. For forks, Proofly also
        verifies the user’s commits across every branch before any work counts.
      </p>
    </form>
  );
}
