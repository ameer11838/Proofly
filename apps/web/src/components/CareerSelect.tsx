import { careerPathLabels, careerPaths, type CareerPath } from '@proofly/shared-types';

interface CareerSelectProps {
  value: CareerPath;
  onChange: (careerPath: CareerPath) => void;
}

export function CareerSelect({ value, onChange }: CareerSelectProps) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
      Target career
      <select
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 shadow-sm outline-none transition focus:border-aurora focus:ring-4 focus:ring-indigo-100"
        value={value}
        onChange={(event) => onChange(event.target.value as CareerPath)}
      >
        {careerPaths.map((careerPath) => (
          <option key={careerPath} value={careerPath}>
            {careerPathLabels[careerPath]}
          </option>
        ))}
      </select>
    </label>
  );
}
