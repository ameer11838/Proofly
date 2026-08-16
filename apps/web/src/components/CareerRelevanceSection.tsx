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
      <p className="text-sm text-[var(--muted)]">{relevance.summary}</p>

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
              <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                <span
                  className={`size-2 rounded-full ${dotColor(group.strength)}`}
                  aria-hidden="true"
                />
                {group.title}
                <span className="font-mono text-xs font-normal text-[var(--muted)]">
                  ({skills.length})
                </span>
              </h4>
              <p className="text-xs text-[var(--muted)]">{group.blurb}</p>
            </div>
            <ul className="mt-2 grid border-y border-[var(--border)] md:grid-cols-2">
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
    <li
      className={`border-b border-[var(--border)] px-3 py-4 md:odd:border-r ${cardColor(skill.strength)}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--text)]">
          {skill.label}
        </p>
        <span className="technical-label shrink-0 normal-case tracking-normal">
          weight {skill.weight}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{skill.description}</p>

      {skill.matchedSignals.length > 0 ? (
        <ul className="mt-2 grid gap-1">
          {skill.matchedSignals.slice(0, 3).map((signal) => (
            <li key={signal} className="text-xs text-[var(--text)]">
              <span className="text-[var(--success)]" aria-hidden="true">
                ✓
              </span>{' '}
              {signal}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
        {skill.rationale}
      </p>
    </li>
  );
}

function dotColor(strength: EvidenceStrength): string {
  if (strength === 'strong') {
    return 'bg-[var(--success)]';
  }

  if (strength === 'moderate') {
    return 'bg-[var(--warning)]';
  }

  return 'bg-[var(--border-strong)]';
}

function cardColor(strength: EvidenceStrength): string {
  if (strength === 'strong') {
    return 'bg-[var(--success-soft)]/40';
  }

  if (strength === 'moderate') {
    return 'bg-[var(--warning-soft)]/40';
  }

  return 'bg-[var(--surface-subtle)]';
}
