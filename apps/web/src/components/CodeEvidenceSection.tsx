import { useId, useMemo, useState } from 'react';
import {
  scoreCategoryLabels,
  type CodeEvidence,
  type CodeQualityFinding,
  type FindingSeverity,
} from '@proofly/shared-types';
import { CodeFragment } from './CodeFragment.js';
import { Collapsible } from './Collapsible.js';

interface CodeEvidenceSectionProps {
  codeEvidence: CodeEvidence[];
  qualityFindings: CodeQualityFinding[];
}

type EvidenceFilter =
  'all' | 'strengths' | 'improvements' | 'career' | 'quality';

interface EvidenceItem {
  id: string;
  source: 'career' | 'quality';
  kind: 'strength' | 'improvement';
  severity: FindingSeverity;
  path: string;
  startLine: number;
  endLine: number;
  matchOffset: number;
  language: string;
  fragment: string;
  title: string;
  detected: string;
  why: string;
  contribution: string;
  suggestion?: string;
  example?: string;
  githubUrl: string;
  commitSha?: string;
}

const filters: Array<{ key: EvidenceFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'strengths', label: 'Strengths' },
  { key: 'improvements', label: 'Improvements' },
  { key: 'career', label: 'Career evidence' },
  { key: 'quality', label: 'Code quality' },
];

const severities: Array<'all' | FindingSeverity> = [
  'all',
  'High',
  'Medium',
  'Low',
];

export function CodeEvidenceSection({
  codeEvidence,
  qualityFindings,
}: CodeEvidenceSectionProps) {
  const [filter, setFilter] = useState<EvidenceFilter>('all');
  const [severity, setSeverity] = useState<'all' | FindingSeverity>('all');
  const [file, setFile] = useState('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const instanceId = useId().replace(/:/g, '');
  const items = useMemo(
    () => normalizeEvidence(codeEvidence, qualityFindings),
    [codeEvidence, qualityFindings],
  );
  const files = [...new Set(items.map((item) => item.path))].sort();
  const visible = items.filter(
    (item) =>
      (filter === 'all' ||
        (filter === 'strengths' && item.kind === 'strength') ||
        (filter === 'improvements' && item.kind === 'improvement') ||
        (filter === 'career' && item.source === 'career') ||
        (filter === 'quality' && item.source === 'quality')) &&
      (severity === 'all' || item.severity === severity) &&
      (file === 'all' || item.path === file),
  );
  const safeIndex = visible.length === 0 ? 0 : activeIndex % visible.length;

  if (items.length === 0) {
    return (
      <p className="card-inset px-3 py-2.5 text-sm text-[var(--muted)]">
        No line in the files that were read produced a reliable finding.
      </p>
    );
  }

  function jump(direction: -1 | 1) {
    if (visible.length === 0) return;
    const next = (safeIndex + direction + visible.length) % visible.length;
    setActiveIndex(next);
    document
      .getElementById(`${instanceId}-evidence-${visible[next]?.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function copy(item: EvidenceItem) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(item.fragment);
      } else {
        legacyCopy(item.fragment);
      }
    } catch {
      legacyCopy(item.fragment);
    }
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId(null), 1_500);
  }

  return (
    <div className="grid gap-5">
      <p className="text-sm leading-6 text-[var(--muted)]">
        Each fragment is copied from the source that was read, and the
        highlighted line is the one that triggered the finding.
      </p>

      <div className="sticky top-0 z-10 grid gap-3 border-y-2 border-[var(--line)] bg-[var(--surface)] py-3">
        <div className="flex flex-wrap gap-1" aria-label="Evidence category">
          {filters.map((option) => (
            <FilterButton
              key={option.key}
              active={filter === option.key}
              onClick={() => {
                setFilter(option.key);
                setActiveIndex(0);
              }}
            >
              {option.label}
            </FilterButton>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="label-mono" htmlFor="evidence-file-filter">
            File
          </label>
          <select
            id="evidence-file-filter"
            className="field min-w-48 px-2.5 py-1 font-mono text-xs"
            value={file}
            onChange={(event) => {
              setFile(event.target.value);
              setActiveIndex(0);
            }}
          >
            <option value="all">All files</option>
            {files.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
          <span className="label-mono ml-1">Severity</span>
          {severities.map((option) => (
            <FilterButton
              key={option}
              active={severity === option}
              onClick={() => {
                setSeverity(option);
                setActiveIndex(0);
              }}
            >
              {option === 'all' ? 'All' : option}
            </FilterButton>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="btn focus-control px-2 py-1 text-xs"
              disabled={visible.length < 2}
              onClick={() => jump(-1)}
              aria-label="Previous finding"
            >
              ←
            </button>
            <span className="w-14 text-center text-xs tabular-nums text-[var(--muted)]">
              {visible.length === 0
                ? '0 / 0'
                : `${safeIndex + 1} / ${visible.length}`}
            </span>
            <button
              type="button"
              className="btn focus-control px-2 py-1 text-xs"
              disabled={visible.length < 2}
              onClick={() => jump(1)}
              aria-label="Next finding"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted)]">
          No findings match these filters.
        </p>
      ) : (
        <div className="divide-y divide-[var(--hair)] border-y border-[var(--hair)]">
          {visible.map((item, index) => (
            <div id={`${instanceId}-evidence-${item.id}`} key={item.id}>
              <Collapsible
                title={item.path}
                summary={`${item.title} · L${item.startLine}–${item.endLine}`}
                defaultOpen={index === safeIndex}
                badge={
                  <span className={badgeClass(item)}>
                    {item.kind === 'strength' ? 'Strength' : item.severity}
                  </span>
                }
              >
                <article
                  className={`grid gap-4 border-l-[6px] pl-4 ${evidenceSurface(item)}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-[var(--muted)]">
                        {item.path} · L{item.startLine}–{item.endLine}
                      </p>
                      <strong className="display mt-1 block text-base text-[var(--ink)]">
                        {item.title}
                      </strong>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {item.detected}
                        {item.commitSha
                          ? ` · commit ${item.commitSha.slice(0, 7)}`
                          : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn focus-control px-2.5 py-1 text-xs"
                      onClick={() => void copy(item)}
                    >
                      {copiedId === item.id ? 'Copied' : 'Copy code'}
                    </button>
                  </div>

                  <CodeFragment
                    fragment={item.fragment}
                    language={item.language}
                    startLine={item.startLine}
                    matchOffset={item.matchOffset}
                  />

                  <dl className="grid gap-2 border-y border-[var(--hair)] py-3 text-sm">
                    <EvidenceRow
                      label="What was found"
                      value={item.contribution}
                    />
                    <EvidenceRow label="Why it matters" value={item.why} />
                  </dl>

                  {item.suggestion ? (
                    <details className="card-flat group bg-[var(--surface-2)] px-3 py-2.5">
                      <summary className="focus-control cursor-pointer text-sm font-medium text-[var(--brand)]">
                        How to fix it
                      </summary>
                      <div className="mt-3 grid gap-2 text-sm text-[var(--ink)]">
                        <p>{item.suggestion}</p>
                        {item.example ? (
                          <pre className="overflow-x-auto rounded-[var(--radius)] border-2 border-[var(--line)] bg-[#12101a] p-3 font-mono text-xs leading-5 text-[#e9e3f5]">
                            <code>{item.example}</code>
                          </pre>
                        ) : null}
                      </div>
                    </details>
                  ) : null}

                  <a
                    className="btn focus-control w-fit px-2.5 py-1.5 text-xs"
                    href={item.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open on GitHub <span aria-hidden="true">↗</span>
                  </a>
                </article>
              </Collapsible>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function legacyCopy(value: string) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function normalizeEvidence(
  career: CodeEvidence[],
  quality: CodeQualityFinding[],
): EvidenceItem[] {
  return [
    ...career.map((evidence): EvidenceItem => ({
      id: `career-${evidence.id}`,
      source: 'career',
      kind: 'strength',
      severity: 'Low',
      path: evidence.path,
      startLine: evidence.startLine,
      endLine: evidence.endLine,
      matchOffset: evidence.matchOffset,
      language: evidence.language,
      fragment: evidence.fragment,
      title: evidence.skillLabel,
      detected: `${scoreCategoryLabels[evidence.category]} · ${evidence.detected}`,
      why: evidence.why,
      contribution: evidence.scoreImpact,
      githubUrl: evidence.githubUrl,
      commitSha: evidence.commitSha,
    })),
    ...quality.map((finding): EvidenceItem => ({
      id: finding.id,
      source: 'quality',
      kind: finding.kind,
      severity: finding.severity,
      path: finding.path,
      startLine: finding.startLine,
      endLine: finding.endLine,
      matchOffset: finding.matchOffset,
      language: finding.language,
      fragment: finding.fragment,
      title: finding.title,
      detected: `Code quality · ${finding.dimension.replace('-', ' ')}`,
      why: finding.why,
      contribution: finding.found,
      suggestion:
        finding.kind === 'improvement' ? finding.suggestion : undefined,
      example: finding.example,
      githubUrl: finding.githubUrl,
    })),
  ];
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`pill focus-control ${
        active
          ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
          : 'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-3)]'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_1fr]">
      <dt className="label-mono">{label}</dt>
      <dd className="text-[var(--muted)]">{value}</dd>
    </div>
  );
}

function badgeClass(item: EvidenceItem): string {
  const base = 'pill';
  if (item.kind === 'strength') {
    return `${base} bg-[var(--success-soft)] text-[var(--success)]`;
  }
  if (isGenuineIssue(item.title)) {
    return `${base} bg-[var(--danger-soft)] text-[var(--danger)]`;
  }
  return `${base} bg-[var(--warning-soft)] text-[var(--warning)]`;
}

function evidenceSurface(item: EvidenceItem): string {
  if (item.kind === 'strength') {
    return 'border-[var(--success)]';
  }
  if (isGenuineIssue(item.title)) {
    return 'border-[var(--danger)]';
  }
  return 'border-[var(--warning)]';
}

function isGenuineIssue(title: string): boolean {
  return /credential|unsafe|sql|silenced error/i.test(title);
}
