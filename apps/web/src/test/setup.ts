import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// jsdom does not implement matchMedia, which the theme system reads on first render.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});
