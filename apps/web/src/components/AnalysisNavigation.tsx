import { useEffect, useState } from 'react';

const sections = [
  ['overview', 'Overview'],
  ['scores', 'Scores'],
  ['career', 'Career Fit'],
  ['quality', 'Code Quality'],
  ['evidence', 'Code Evidence'],
  ['commits', 'Commits'],
  ['improvements', 'Improvements'],
  ['files', 'Files'],
] as const;

export function AnalysisNavigation({ prefix }: { prefix: string }) {
  const sectionId = (key: string) => `${prefix}-${key}`;
  const [active, setActive] = useState<string>(sectionId(sections[0][0]));

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.25, 0.6] },
    );
    sections.forEach(([key]) => {
      const element = document.getElementById(sectionId(key));
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [prefix]);

  return (
    <nav
      aria-label="Analysis sections"
      className="sticky top-0 z-20 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)] px-5 py-2"
    >
      <ul className="flex min-w-max gap-1">
        {sections.map(([key, label]) => {
          const id = sectionId(key);
          return (
          <li key={key}>
            <a
              href={`#${id}`}
              aria-current={active === id ? 'location' : undefined}
              className={`focus-control block rounded-[5px] px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide transition ${
                active === id
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {label}
            </a>
          </li>
          );
        })}
      </ul>
    </nav>
  );
}
