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
    <form
      className="rounded-[1.75rem] border border-white/80 bg-white/85 p-6 shadow-soft backdrop-blur lg:p-7 dark:border-slate-800 dark:bg-slate-900/80"
      onSubmit={onSubmit}
    >
      {/* Full-width fields: side-by-side columns truncated longer career labels such as
          "DevOps and cloud engineering" at this card width. */}
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <label
            className="text-[0.8125rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            htmlFor="github-username"
          >
            GitHub username
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-slate-400 dark:text-slate-500">
              @
            </span>
            <input
              id="github-username"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-9 pr-4 text-base font-medium text-slate-900 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-aurora focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/25"
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
        className="mt-4 h-[54px] w-full rounded-2xl bg-slate-950 px-7 text-base font-semibold text-white shadow-lg shadow-slate-300/60 transition hover:bg-aurora disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:shadow-indigo-950/50 dark:hover:bg-indigo-400"
        disabled={isLoading || username.trim().length === 0}
        type="submit"
      >
        {isLoading ? 'Reading GitHub…' : 'Rank repositories'}
      </button>

      <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
        Ranking reads public repository metadata only. Choosing a repository
        runs the deeper file-level analysis.
      </p>
    </form>
  );
}
