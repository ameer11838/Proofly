import type {
  RelevanceBand,
  RepositoryAnalysisResponse,
} from '@proofly/shared-types';
import { CareerRelevanceSection } from './CareerRelevanceSection.js';
import { CodeEvidenceSection } from './CodeEvidenceSection.js';
import { Collapsible } from './Collapsible.js';
import { FileInspector } from './FileInspector.js';
import { ImprovementSection } from './ImprovementSection.js';
import { ScoreBreakdownSection } from './ScoreBreakdownSection.js';

interface AnalysisPanelProps {
  analysis: RepositoryAnalysisResponse;
}

export function AnalysisPanel({ analysis }: AnalysisPanelProps) {
  const {
    rating,
    breakdown,
    engineering,
    careerRelevance,
    codeEvidence,
    improvementPlan,
    fileReport,
  } = analysis;
  const strongSkills = careerRelevance.skills.filter(
    (skill) => skill.strength === 'strong',
  ).length;

  return (
    <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* 1. The score itself, and what it is made of. */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-950 to-indigo-950 px-6 py-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">
              Proofly score
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tight">
                {rating.score.toFixed(1)}
              </span>
              <span className="text-lg font-semibold text-slate-400">
                / {breakdown.maxScore.toFixed(0)}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                {rating.label}
              </span>
            </p>
          </div>

          {/* 2. Engineering quality and career fit, deliberately reported apart. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile
              label="Engineering evidence"
              value={`${engineering.score}%`}
              band={engineering.band}
              caption="Docs, tests, CI, structure, completeness"
            />
            <StatTile
              label={careerRelevance.label}
              value={`${careerRelevance.score}%`}
              band={careerRelevance.band}
              caption={`${strongSkills} of ${careerRelevance.skills.length} skills strongly evidenced`}
            />
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
          {rating.summary}
        </p>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-300/80">
          These two measures move independently: a well-built project can be a
          weak match for this career, and a strong career match can still be
          poorly engineered.
        </p>
      </div>

      <div className="px-6 py-2">
        {/* 3-7. Progressive detail, collapsed by default apart from the breakdown. */}
        <Collapsible
          title="Score breakdown"
          summary="How the six categories add up to the score"
          defaultOpen
          badge={
            <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {breakdown.score.toFixed(1)}/{breakdown.maxScore.toFixed(0)}
            </span>
          }
        >
          <ScoreBreakdownSection breakdown={breakdown} />
        </Collapsible>

        <Collapsible
          title={careerRelevance.label}
          summary="Which career skills the repository can actually prove"
          badge={
            <span className="flex items-center gap-2">
              <Badge band={careerRelevance.band} tone="light">
                {careerRelevance.band}
              </Badge>
              <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {careerRelevance.score}%
              </span>
            </span>
          }
        >
          <CareerRelevanceSection relevance={careerRelevance} />
        </Collapsible>

        <Collapsible
          title="Key findings"
          summary="One finding per scored category, plus hygiene checks"
          badge={
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              {analysis.findings.length}
            </span>
          }
        >
          <ul className="grid gap-2">
            {analysis.findings.map((finding) => (
              <li
                key={`${finding.category}-${finding.explanation}`}
                className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {finding.category}
                  </p>
                  <span className={importanceClassName(finding.importance)}>
                    {finding.importance}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {finding.explanation}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  <span className="font-medium">Recommendation:</span>{' '}
                  {finding.recommendation}
                </p>
              </li>
            ))}
          </ul>
        </Collapsible>

        <Collapsible
          title="Code evidence"
          summary="Actual lines from the repository that triggered a detection"
          badge={
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              {codeEvidence.length}
            </span>
          }
        >
          <CodeEvidenceSection codeEvidence={codeEvidence} />
        </Collapsible>

        <Collapsible
          title="Improve this repo"
          summary={`${improvementPlan.currentScore.toFixed(1)} → ${improvementPlan.potentialScore.toFixed(1)} if every action below is done`}
          badge={
            <span className="rounded-full bg-aurora/10 dark:bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-aurora dark:text-indigo-300">
              +
              {(
                improvementPlan.potentialScore - improvementPlan.currentScore
              ).toFixed(1)}
            </span>
          }
        >
          <ImprovementSection plan={improvementPlan} />
        </Collapsible>

        <Collapsible
          title="Files Proofly inspected"
          summary={`${fileReport.analyzedCount} analyzed · ${fileReport.ignoredCount} ignored`}
        >
          <FileInspector report={fileReport} repository={analysis.repository} />
        </Collapsible>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  band,
  caption,
}: {
  label: string;
  value: string;
  band: RelevanceBand;
  caption: string;
}) {
  return (
    <div className="min-w-48 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
        {label}
      </p>
      <p className="mt-0.5 flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        <Badge band={band}>{band}</Badge>
      </p>
      <p className="mt-1 text-xs leading-4 text-slate-300/90">{caption}</p>
    </div>
  );
}

function Badge({
  band,
  tone = 'dark',
  children,
}: {
  band: RelevanceBand;
  tone?: 'dark' | 'light';
  children: React.ReactNode;
}) {
  const colors: Record<'dark' | 'light', Record<RelevanceBand, string>> = {
    dark: {
      Strong: 'bg-emerald-400/20 text-emerald-300',
      Moderate: 'bg-amber-400/20 text-amber-200',
      Limited: 'bg-slate-400/20 text-slate-300',
    },
    light: {
      Strong: 'bg-emerald-100 text-emerald-700',
      Moderate: 'bg-amber-100 text-amber-700',
      Limited: 'bg-slate-200 text-slate-600',
    },
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[tone][band]}`}
    >
      {children}
    </span>
  );
}

function importanceClassName(importance: 'High' | 'Medium' | 'Low'): string {
  const base = 'rounded-full px-2 py-0.5 text-xs font-semibold';

  if (importance === 'High') {
    return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300`;
  }

  if (importance === 'Medium') {
    return `${base} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`;
  }

  return `${base} bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300`;
}
