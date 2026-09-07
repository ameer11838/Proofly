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
      <label className="label-mono" htmlFor={id}>
        Target career
      </label>
      <div className="relative">
        <select
          id={id}
          className="field appearance-none py-2.5 pl-3 pr-9 text-sm font-medium"
          value={value}
          onChange={(event) => onChange(event.target.value as CareerPath)}
        >
          {careerPathGroups.map((group) => (
            <optgroup
              key={group.label}
              label={group.label}
              className="bg-[var(--surface)] text-[var(--ink)]"
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
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ink)]"
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
