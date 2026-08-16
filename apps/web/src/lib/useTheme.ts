import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

export const themeStorageKey = 'proofly-theme';

export function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(themeStorageKey);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    // Private browsing and blocked storage should not break rendering.
    return null;
  }
}

export function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return (
    readStoredTheme() ??
    (window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light')
  );
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

/**
 * Keeps the chosen theme on the root element and in local storage. Until the user picks
 * one, the operating system preference is followed live.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (readStoredTheme() === null) {
        setTheme(event.matches ? 'dark' : 'light');
      }
    };

    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';

      try {
        window.localStorage.setItem(themeStorageKey, next);
      } catch {
        // Preference simply will not persist if storage is unavailable.
      }

      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
