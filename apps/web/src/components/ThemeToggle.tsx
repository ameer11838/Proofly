import type { Theme } from '../lib/useTheme.js';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-600 shadow-sm transition hover:border-aurora hover:text-aurora focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-aurora dark:hover:text-indigo-300 dark:focus-visible:ring-indigo-500/30"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="4.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M12 2.75v2M12 19.25v2M21.25 12h-2M4.75 12h-2M18.36 5.64l-1.42 1.42M7.06 16.94l-1.42 1.42M18.36 18.36l-1.42-1.42M7.06 7.06L5.64 5.64"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 14.35A8.25 8.25 0 019.65 4a8.25 8.25 0 1010.35 10.35z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}
