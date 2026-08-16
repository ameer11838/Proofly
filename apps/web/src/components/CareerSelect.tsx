import {
  careerPathGroups,
  careerPathLabels,
  type CareerPath,
} from '@proofly/shared-types';

interface CareerSelectProps {
  value: CareerPath;
  onChange: (careerPath: CareerPath) => void;
  id?: string;
}

export function CareerSelect({
  value,
  onChange,
  id = 'career-path',
}: CareerSelectProps) {
  return (
    <div className="grid gap-1.5">
      <label className="technical-label font-semibold" htmlFor={id}>
        Target career
      </label>
      <div className="relative">
        <select
          id={id}
          className="focus-control w-full appearance-none rounded-[7px] border border-[var(--border)] bg-[var(--surface-subtle)] py-3 pl-3.5 pr-10 text-sm font-medium text-[var(--text)] outline-none transition hover:border-[var(--border-strong)]"
          value={value}
          onChange={(event) => onChange(event.target.value as CareerPath)}
        >
          {careerPathGroups.map((group) => (
            <optgroup
              key={group.label}
              label={group.label}
              className="bg-[var(--surface)] text-[var(--text)]"
            >
              {group.careerPaths.map((careerPath) => (
                <option key={careerPath} value={careerPath}>
                  {careerPathLabels[careerPath]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
