import type {
  RelevanceBand,
  RepositoryAnalysisResponse,
} from '@proofly/shared-types';
import { CareerRelevanceSection } from './CareerRelevanceSection.js';
import { AnalysisNavigation } from './AnalysisNavigation.js';
import { AnalysisOverview } from './AnalysisOverview.js';
import { CodeEvidenceSection } from './CodeEvidenceSection.js';
import { CodeQualitySection } from './CodeQualitySection.js';
import { Collapsible } from './Collapsible.js';
import { FileInspector } from './FileInspector.js';
import { ImprovementSection } from './ImprovementSection.js';
import { DevelopmentActivitySection } from './DevelopmentActivitySection.js';
import { ScoreBreakdownSection } from './ScoreBreakdownSection.js';
import { AiFeedbackSection } from './AiFeedbackSection.js';

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
    codeQuality,
    developmentActivity,
    improvementPlan,
    fileReport,
  } = analysis;
  const strongSkills = careerRelevance.skills.filter(
    (skill) => skill.strength === 'strong',
  ).length;
  const navigationPrefix = `analysis-${analysis.repository.id}`;
  const sectionId = (key: string) => `${navigationPrefix}-${key}`;

  return (
    <div className="card-flat mt-5 overflow-hidden">
      {analysis.userContribution ? (
        <div className="border-b-2 border-[var(--line)] bg-[var(--success-soft)] px-5 py-2.5 text-xs text-[var(--success)]">
          <span className="font-medium">
            {analysis.userContribution.status}.
          </span>{' '}
          <span>
            Everything below comes only from lines added in those commits.
          </span>
        </div>
      ) : null}
      <AnalysisNavigation prefix={navigationPrefix} />
      {/* 1. The score itself, and what it is made of. */}
      <div
        id={sectionId('overview')}
        className="scroll-mt-14 border-b-2 border-[var(--line)] bg-[var(--surface-2)] px-5 py-6 text-[var(--ink)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="label-mono">Repository score</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="display text-6xl tabular-nums">
                {rating.score.toFixed(1)}
              </span>
              <span className="text-lg text-[var(--muted)]">
                / {breakdown.maxScore.toFixed(0)}
              </span>
              <span className="pill bg-[var(--accent)] text-[var(--accent-ink)]">
                {rating.label}
              </span>
            </p>
          </div>

          {/* 2. Project strength and career fit, deliberately reported apart. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile
              label="Project strength"
              value={`${engineering.score}%`}
              band={engineering.band}
              caption="Depth, complexity, quality, presentation"
            />
            <StatTile
              label={careerRelevance.label}
              value={`${careerRelevance.score}%`}
              band={careerRelevance.band}
              caption={`${strongSkills} of ${careerRelevance.skills.length} skills strongly evidenced`}
            />
          </div>
        </div>

        <p className="mt-5 max-w-measure text-base text-[var(--ink)]">
          {rating.summary}
        </p>
      </div>

      <AnalysisOverview analysis={analysis} />

      {analysis.aiFeedback ? (
        <AiFeedbackSection feedback={analysis.aiFeedback} />
      ) : null}

      <div className="px-5 py-2">
        {/* 3-7. Progressive detail, collapsed by default apart from the breakdown. */}
        <div id={sectionId('scores')} className="scroll-mt-14">
          <Collapsible
            title={
              analysis.aiFeedback
                ? 'Deterministic score breakdown'
                : 'Score breakdown'
            }
            summary={
              analysis.aiFeedback
                ? 'The rule-based assessment that contributes 70% of the final score'
                : 'How the five categories add up to the score'
            }
            badge={
              <span className="text-xs font-medium tabular-nums text-[var(--muted)]">
                {breakdown.score.toFixed(1)}/{breakdown.maxScore.toFixed(0)}
              </span>
            }
          >
            <ScoreBreakdownSection breakdown={breakdown} />
          </Collapsible>
        </div>

        <div id={sectionId('career')} className="scroll-mt-14">
          <Collapsible
            title={careerRelevance.label}
            summary="Which career skills this repository can prove"
            badge={
              <span className="flex items-center gap-2">
                <Badge band={careerRelevance.band}>
                  {careerRelevance.band}
                </Badge>
                <span className="text-xs font-medium tabular-nums text-[var(--muted)]">
                  {careerRelevance.score}%
                </span>
              </span>
            }
          >
            <CareerRelevanceSection relevance={careerRelevance} />
          </Collapsible>
        </div>

        <div id={sectionId('quality')} className="scroll-mt-14">
          <Collapsible
            title="Code quality"
            summary="Readability, structure, error handling, and documentation"
            badge={
              <span className="text-xs font-medium tabular-nums text-[var(--muted)]">
                {codeQuality.score.toFixed(1)}/10
              </span>
            }
          >
            <CodeQualitySection report={codeQuality} />
          </Collapsible>
        </div>

        <Collapsible
          title="Key findings"
          summary="One per scored category, plus hygiene checks"
          badge={
            <span className="text-xs font-medium tabular-nums text-[var(--muted)]">
              {analysis.findings.length}
            </span>
          }
        >
          <ul className="grid gap-3">
            {analysis.findings.map((finding) => (
              <li
                key={`${finding.category}-${finding.explanation}`}
                className={`rounded-[var(--radius)] border-2 border-l-[6px] border-[var(--line)] px-4 py-3.5 ${findingBackground(finding.category, finding.importance)}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="display text-base text-[var(--ink)]">
                    {finding.category}
                  </p>
                  <span className={importanceClassName(finding.importance)}>
                    {finding.importance}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {finding.explanation}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--ink)]">
                  <span className="font-medium">Recommendation:</span>{' '}
                  {finding.recommendation}
                </p>
              </li>
            ))}
          </ul>
        </Collapsible>

        <div id={sectionId('evidence')} className="scroll-mt-14">
          <Collapsible
            title="Code evidence"
            summary="The source lines behind each strength and each improvement"
            badge={
              <span className="text-xs font-medium tabular-nums text-[var(--muted)]">
                {codeEvidence.length + codeQuality.findings.length}
              </span>
            }
          >
            <CodeEvidenceSection
              codeEvidence={codeEvidence}
              qualityFindings={codeQuality.findings}
            />
          </Collapsible>
        </div>

        <div id={sectionId('commits')} className="scroll-mt-14">
          <Collapsible
            title="Development activity"
            summary="Commit history and message quality"
            badge={
              <span className="text-xs font-medium tabular-nums text-[var(--muted)]">
                {developmentActivity.commitCount} commits
              </span>
            }
          >
            <DevelopmentActivitySection activity={developmentActivity} />
          </Collapsible>
        </div>

        <div id={sectionId('improvements')} className="scroll-mt-14">
          <Collapsible
            title="Improvements"
            summary="Ordered by impact, with quick wins separated out"
            badge={
              <span className="text-xs font-medium tabular-nums text-[var(--muted)]">
                {improvementPlan.actions.length}
              </span>
            }
          >
            <ImprovementSection plan={improvementPlan} />
          </Collapsible>
        </div>

        <div id={sectionId('files')} className="scroll-mt-14">
          <Collapsible
            title="Files inspected"
            summary={`${fileReport.analyzedCount} analyzed · ${fileReport.ignoredCount} ignored`}
          >
            <FileInspector
              report={fileReport}
              repository={analysis.repository}
            />
          </Collapsible>
        </div>
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
    <div className="min-w-48 border-l-2 border-[var(--hair)] px-4 py-1 first:border-l-0 first:pl-0">
      <p className="label-mono">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="display text-3xl tabular-nums">{value}</span>
        <Badge band={band}>{band}</Badge>
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{caption}</p>
    </div>
  );
}

function Badge({
  band,
  children,
}: {
  band: RelevanceBand;
  children: React.ReactNode;
}) {
  const colors: Record<RelevanceBand, string> = {
    Strong: 'bg-[var(--success-soft)] text-[var(--success)]',
    Moderate: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    Limited: 'bg-[var(--surface-3)] text-[var(--muted)]',
  };

  return <span className={`pill ${colors[band]}`}>{children}</span>;
}

function importanceClassName(importance: 'High' | 'Medium' | 'Low'): string {
  const base = 'pill';

  if (importance === 'High') {
    return `${base} bg-[var(--warning-soft)] text-[var(--warning)]`;
  }

  if (importance === 'Medium') {
    return `${base} bg-[var(--warning-soft)] text-[var(--warning)]`;
  }

  return `${base} bg-[var(--surface-2)] text-[var(--muted)]`;
}

function findingBackground(
  category: string,
  importance: 'High' | 'Medium' | 'Low',
): string {
  if (/security/i.test(category) && importance === 'High') {
    return 'border-[var(--danger)] bg-[var(--danger-soft)]';
  }
  if (importance === 'High' || importance === 'Medium') {
    return 'border-[var(--warning)] bg-[var(--warning-soft)]';
  }
  return 'border-[var(--success)] bg-[var(--success-soft)]';
}
