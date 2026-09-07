import {
  careerPathGroups,
  careerPathLabels,
  type CareerPath,
} from '@proofly/shared-types';

interface CareerTrackStripProps {
  value: CareerPath;
  onChange: (careerPath: CareerPath) => void;
}

const trackCount = careerPathGroups.reduce(
  (total, group) => total + group.careerPaths.length,
  0,
);

/**
 * Shown before a search has run. It answers "what can this score me against?"
 * without making the visitor open the select first, and each track is a real
 * control rather than decoration.
 */
export function CareerTrackStrip({ value, onChange }: CareerTrackStripProps) {
  return (
    <section className="card mt-12 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-[var(--line)] pb-3">
        <h2 className="label-mono">Scored against {trackCount} career tracks</h2>
        <p className="text-xs text-[var(--muted)]">
          Pick one now, or change it any time.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {careerPathGroups.map((group) => (
          <div key={group.label}>
            <h3 className="label-mono mb-2 text-[var(--ink)]">{group.label}</h3>
            <ul className="flex flex-wrap gap-2">
              {group.careerPaths.map((careerPath) => {
                const selected = careerPath === value;
                return (
                  <li key={careerPath}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onChange(careerPath)}
                      className={`pill focus-control transition-colors ${
                        selected
                          ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                          : 'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-3)]'
                      }`}
                    >
                      {careerPathLabels[careerPath]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
