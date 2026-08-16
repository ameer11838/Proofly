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
      <label
        className="text-[0.8125rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        htmlFor={id}
      >
        Target career
      </label>
      <div className="relative">
        <select
          id={id}
          className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3.5 pl-4 pr-10 text-base font-medium text-slate-900 shadow-sm outline-none transition hover:border-slate-300 focus:border-aurora focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/25"
          value={value}
          onChange={(event) => onChange(event.target.value as CareerPath)}
        >
          {careerPathGroups.map((group) => (
            <optgroup
              key={group.label}
              label={group.label}
              className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100"
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
          className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
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
