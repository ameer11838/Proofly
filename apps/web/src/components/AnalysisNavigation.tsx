import { useEffect, useState } from 'react';

const sections = [
  ['overview', 'Overview'],
  ['scores', 'Scores'],
  ['career', 'Career fit'],
  ['quality', 'Code quality'],
  ['evidence', 'Evidence'],
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
      className="sticky top-0 z-20 overflow-x-auto border-b-2 border-[var(--line)] bg-[var(--surface)] px-3"
    >
      <ul className="flex min-w-max">
        {sections.map(([key, label]) => {
          const id = sectionId(key);
          return (
          <li key={key}>
            <a
              href={`#${id}`}
              aria-current={active === id ? 'location' : undefined}
              className={`label-mono focus-control -mb-0.5 block border-b-4 px-3 py-2.5 ${
                active === id
                  ? 'border-[var(--brand)] text-[var(--ink)]'
                  : 'border-transparent hover:text-[var(--ink)]'
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
