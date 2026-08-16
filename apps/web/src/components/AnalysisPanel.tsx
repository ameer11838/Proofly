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
    <div className="mt-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
      {analysis.userContribution ? (
        <div className="border-b border-[var(--border)] bg-[var(--success-soft)] px-6 py-3 font-mono text-xs text-[var(--success)]">
          <span className="font-semibold">
            {analysis.userContribution.status}
          </span>
          <span className="ml-2">
            Only lines added in these verified commits are used below;
            repository-wide code and metadata from other contributors are
            excluded.
          </span>
        </div>
      ) : null}
      <AnalysisNavigation prefix={navigationPrefix} />
      {/* 1. The score itself, and what it is made of. */}
      <div
        id={sectionId('overview')}
        className="scroll-mt-14 border-b border-[var(--border)] bg-[var(--surface-strong)] px-6 py-7 text-[var(--text)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
              03 / Evidence · Proofly score
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tight">
                {rating.score.toFixed(1)}
              </span>
              <span className="text-lg font-semibold text-[var(--muted)]">
                / {breakdown.maxScore.toFixed(0)}
              </span>
              <span className="rounded-[5px] border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-1 font-mono text-xs font-semibold uppercase tracking-wide">
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
              caption="Technical depth, complexity, quality, presentation"
            />
            <StatTile
              label={careerRelevance.label}
              value={`${careerRelevance.score}%`}
              band={careerRelevance.band}
              caption={`${strongSkills} of ${careerRelevance.skills.length} skills strongly evidenced`}
            />
          </div>
        </div>

        <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-[var(--text)]">
          {rating.summary}
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
          These measures answer different questions: project strength captures
          what was built and how convincingly it is presented, while career
          relevance measures fit for the selected path.
        </p>
      </div>

      <AnalysisOverview analysis={analysis} />

      <div className="px-6 py-2">
        {/* 3-7. Progressive detail, collapsed by default apart from the breakdown. */}
        <div id={sectionId('scores')} className="scroll-mt-14">
          <Collapsible
            title="Score breakdown"
            summary="How the five portfolio-focused categories add up to the score"
            badge={
              <span className="font-mono text-xs font-semibold tabular-nums text-[var(--text)]">
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
            summary="Which career skills the repository can actually prove"
            badge={
              <span className="flex items-center gap-2">
                <Badge band={careerRelevance.band} tone="light">
                  {careerRelevance.band}
                </Badge>
                <span className="font-mono text-xs font-semibold tabular-nums text-[var(--text)]">
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
            title="Code Readability & Documentation"
            summary="Readability, modularity, error handling, documentation, and maintainability"
            badge={
              <span className="font-mono text-xs font-semibold text-[var(--text)]">
                {codeQuality.score.toFixed(1)}/10
              </span>
            }
          >
            <CodeQualitySection report={codeQuality} />
          </Collapsible>
        </div>

        <Collapsible
          title="Key findings"
          summary="One finding per scored category, plus hygiene checks"
          badge={
            <span className="font-mono text-xs font-semibold text-[var(--muted)]">
              {analysis.findings.length}
            </span>
          }
        >
          <ul className="grid gap-3">
            {analysis.findings.map((finding) => (
              <li
                key={`${finding.category}-${finding.explanation}`}
                className={`rounded-[var(--radius-sm)] border-l-4 px-4 py-4 ${findingBackground(finding.category, finding.importance)}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-bold text-[var(--text)]">
                    {finding.category}
                  </p>
                  <span className={importanceClassName(finding.importance)}>
                    {finding.importance}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {finding.explanation}
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--text)]">
                  <span className="font-bold text-[var(--warning)]">
                    Recommendation:
                  </span>{' '}
                  {finding.recommendation}
                </p>
              </li>
            ))}
          </ul>
        </Collapsible>

        <div id={sectionId('evidence')} className="scroll-mt-14">
          <Collapsible
            title="Code evidence"
            summary="Interactive source-backed strengths, career evidence, and improvements"
            badge={
              <span className="font-mono text-xs font-semibold text-[var(--muted)]">
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
            summary="Attributable commit history and message quality"
            badge={
              <span className="font-mono text-xs font-semibold text-[var(--text)]">
                {developmentActivity.commitCount} commits
              </span>
            }
          >
            <DevelopmentActivitySection activity={developmentActivity} />
          </Collapsible>
        </div>

        <div id={sectionId('improvements')} className="scroll-mt-14">
          <Collapsible
            title="Improve this repo"
            summary="Prioritized, evidence-backed improvements and quick wins"
            badge={
              <span className="font-mono text-xs font-bold text-[var(--accent)]">
                {improvementPlan.actions.length}
              </span>
            }
          >
            <div>
              <p className="section-kicker mb-3">04 / Improvements</p>
              <ImprovementSection plan={improvementPlan} />
            </div>
          </Collapsible>
        </div>

        <div id={sectionId('files')} className="scroll-mt-14">
          <Collapsible
            title="Files Proofly inspected"
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
    <div className="min-w-48 border-l border-[var(--border)] px-4 py-1 first:border-l-0">
      <p className="font-mono text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        <Badge band={band}>{band}</Badge>
      </p>
      <p className="mt-1 text-sm leading-5 text-[var(--muted)]">{caption}</p>
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
      Strong: 'bg-[var(--success-soft)] text-[var(--success)]',
      Moderate: 'bg-[var(--warning-soft)] text-[var(--warning)]',
      Limited: 'bg-[var(--surface-raised)] text-[var(--muted)]',
    },
    light: {
      Strong: 'bg-[var(--success-soft)] text-[var(--success)]',
      Moderate: 'bg-[var(--warning-soft)] text-[var(--warning)]',
      Limited: 'bg-[var(--surface-raised)] text-[var(--muted)]',
    },
  };

  return (
    <span
      className={`rounded-[5px] px-2 py-0.5 font-mono text-xs font-semibold uppercase ${colors[tone][band]}`}
    >
      {children}
    </span>
  );
}

function importanceClassName(importance: 'High' | 'Medium' | 'Low'): string {
  const base =
    'rounded-[5px] px-2 py-0.5 font-mono text-xs font-semibold uppercase';

  if (importance === 'High') {
    return `${base} bg-[var(--warning-soft)] text-[var(--warning)]`;
  }

  if (importance === 'Medium') {
    return `${base} bg-[var(--warning-soft)] text-[var(--warning)]`;
  }

  return `${base} bg-[var(--surface-subtle)] text-[var(--muted)]`;
}

function findingBackground(
  category: string,
  importance: 'High' | 'Medium' | 'Low',
): string {
  if (/security/i.test(category) && importance === 'High') {
    return 'border-[var(--error)] bg-[var(--error-soft)]';
  }
  if (importance === 'High' || importance === 'Medium') {
    return 'border-[var(--warning)] bg-[var(--warning-soft)]';
  }
  return 'border-[var(--success)] bg-[var(--success-soft)]';
}
