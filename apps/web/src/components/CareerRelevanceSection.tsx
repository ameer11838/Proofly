import type {
  CareerRelevanceReport,
  EvidenceStrength,
  SkillEvidence,
} from '@proofly/shared-types';

interface CareerRelevanceSectionProps {
  relevance: CareerRelevanceReport;
}

const groups: { strength: EvidenceStrength; title: string; blurb: string }[] = [
  {
    strength: 'strong',
    title: 'Strong evidence',
    blurb:
      'Demonstrated by source code, or by a declared dependency plus supporting metadata.',
  },
  {
    strength: 'moderate',
    title: 'Moderate evidence',
    blurb:
      'Suggested by metadata only. Counts half until code demonstrates it.',
  },
  {
    strength: 'missing',
    title: 'Missing or weak evidence',
    blurb:
      'Nothing in the analyzed files supports this skill. Proofly does not claim it.',
  },
];

export function CareerRelevanceSection({
  relevance,
}: CareerRelevanceSectionProps) {
  return (
    <div className="grid gap-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {relevance.summary}
      </p>

      {groups.map((group) => {
        const skills = relevance.skills.filter(
          (skill) => skill.strength === group.strength,
        );

        if (skills.length === 0) {
          return null;
        }

        return (
          <section key={group.strength}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <span
                  className={`size-2 rounded-full ${dotColor(group.strength)}`}
                  aria-hidden="true"
                />
                {group.title}
                <span className="font-normal text-slate-500 dark:text-slate-400">
                  ({skills.length})
                </span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {group.blurb}
              </p>
            </div>
            <ul className="mt-2 grid gap-2 md:grid-cols-2">
              {skills.map((skill) => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SkillCard({ skill }: { skill: SkillEvidence }) {
  return (
    <li className={`rounded-2xl px-4 py-3 ring-1 ${cardColor(skill.strength)}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {skill.label}
        </p>
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
          weight {skill.weight}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
        {skill.description}
      </p>

      {skill.matchedSignals.length > 0 ? (
        <ul className="mt-2 grid gap-1">
          {skill.matchedSignals.slice(0, 3).map((signal) => (
            <li
              key={signal}
              className="text-xs text-slate-700 dark:text-slate-200"
            >
              <span
                className="text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              >
                ✓
              </span>{' '}
              {signal}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {skill.rationale}
      </p>
    </li>
  );
}

function dotColor(strength: EvidenceStrength): string {
  if (strength === 'strong') {
    return 'bg-emerald-500';
  }

  if (strength === 'moderate') {
    return 'bg-amber-500';
  }

  return 'bg-slate-300 dark:bg-slate-600';
}

function cardColor(strength: EvidenceStrength): string {
  if (strength === 'strong') {
    return 'bg-emerald-50/60 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/25';
  }

  if (strength === 'moderate') {
    return 'bg-amber-50/60 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/25';
  }

  return 'bg-slate-50 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700';
}
