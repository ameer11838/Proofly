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
    <form className="card p-5 sm:p-6" onSubmit={onSubmit}>
      <p className="label-mono mb-4 border-b-2 border-[var(--line)] pb-3">
        Run an analysis
      </p>
      {/* Full-width fields: side-by-side columns truncated longer career labels such as
          "DevOps and cloud engineering" at this card width. */}
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <label className="label-mono" htmlFor="github-username">
            GitHub username
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-[var(--muted)]">
              @
            </span>
            <input
              id="github-username"
              className="field py-2.5 pl-7 pr-3 font-mono text-sm font-medium"
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
        className="btn btn-primary focus-control mt-5 h-12 w-full text-base uppercase tracking-wide"
        disabled={isLoading || username.trim().length === 0}
        type="submit"
      >
        {isLoading ? 'Reading…' : 'Rank repositories'}
      </button>

      <p className="mt-5 border-t-2 border-dashed border-[var(--hair)] pt-4 text-xs leading-5 text-[var(--muted)]">
        Only public repositories are read. On a fork, commits are checked across
        every branch first, and only the ones authored by that user count.
      </p>
    </form>
  );
}
