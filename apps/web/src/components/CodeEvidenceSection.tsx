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
  { key: 'career', label: 'Career Evidence' },
  { key: 'quality', label: 'Code Quality' },
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
      <p className="surface-subtle px-4 py-3 text-sm text-[var(--muted)]">
        No source line in the analyzed files produced a reliable technical or
        code-quality finding. Nothing here is inferred.
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
      <p className="text-sm text-[var(--muted)]">
        Every fragment is copied from inspected source. The highlighted line
        triggered the finding; fork evidence remains limited to verified added
        lines.
      </p>

      <div className="sticky top-0 z-10 grid gap-3 border-y border-[var(--border)] bg-[var(--surface)] py-3">
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
          <label className="technical-label" htmlFor="evidence-file-filter">
            File
          </label>
          <select
            id="evidence-file-filter"
            className="focus-control min-w-48 rounded-[6px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 font-mono text-xs text-[var(--text)]"
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
          <span className="technical-label ml-1">Severity</span>
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
              className="focus-control rounded-[6px] border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] disabled:opacity-40"
              disabled={visible.length < 2}
              onClick={() => jump(-1)}
              aria-label="Previous finding"
            >
              ←
            </button>
            <span className="w-14 text-center font-mono text-xs text-[var(--muted)]">
              {visible.length === 0
                ? '0 / 0'
                : `${safeIndex + 1} / ${visible.length}`}
            </span>
            <button
              type="button"
              className="focus-control rounded-[6px] border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] disabled:opacity-40"
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
        <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
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
                  className={`grid gap-4 rounded-[var(--radius-sm)] border-l-4 p-4 ${evidenceSurface(item)}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-[var(--muted)]">
                        {item.path} · L{item.startLine}–{item.endLine}
                      </p>
                      <strong className="mt-1 block font-mono text-xs uppercase tracking-[0.12em] text-[var(--accent)]">
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
                      className="focus-control rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
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

                  <dl className="grid gap-2 border-y border-[var(--border)] py-3 text-sm">
                    <EvidenceRow
                      label="What Proofly found"
                      value={item.contribution}
                    />
                    <EvidenceRow label="Why it matters" value={item.why} />
                  </dl>

                  {item.suggestion ? (
                    <details className="group rounded-[7px] border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3">
                      <summary className="focus-control cursor-pointer font-mono text-sm font-bold text-[var(--warning)]">
                        How can I improve this?
                      </summary>
                      <div className="mt-3 grid gap-2 text-sm text-[var(--text)]">
                        <p>{item.suggestion}</p>
                        {item.example ? (
                          <pre className="overflow-x-auto rounded-[6px] bg-[#080c14] p-3 font-mono text-xs leading-5 text-slate-200">
                            <code>{item.example}</code>
                          </pre>
                        ) : null}
                      </div>
                    </details>
                  ) : null}

                  <a
                    className="focus-control inline-flex w-fit items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs font-semibold text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    href={item.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open file on GitHub <span aria-hidden="true">↗</span>
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
      detected: `Code Quality · ${finding.dimension.replace('-', ' ')}`,
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
      className={`focus-control rounded-[5px] border px-2.5 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
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
      <dt className="technical-label">{label}</dt>
      <dd className="text-[var(--muted)]">{value}</dd>
    </div>
  );
}

function badgeClass(item: EvidenceItem): string {
  const base =
    'rounded-[5px] px-2 py-1 font-mono text-xs font-semibold uppercase';
  if (item.kind === 'strength') {
    return `${base} bg-[var(--success-soft)] text-[var(--success)]`;
  }
  if (isGenuineIssue(item.title)) {
    return `${base} bg-[var(--error-soft)] text-[var(--error)]`;
  }
  return `${base} bg-[var(--warning-soft)] text-[var(--warning)]`;
}

function evidenceSurface(item: EvidenceItem): string {
  if (item.kind === 'strength') {
    return 'border-[var(--success)] bg-[var(--success-soft)]';
  }
  if (isGenuineIssue(item.title)) {
    return 'border-[var(--error)] bg-[var(--error-soft)]';
  }
  return 'border-[var(--warning)] bg-[var(--warning-soft)]';
}

function isGenuineIssue(title: string): boolean {
  return /credential|unsafe|sql|silenced error/i.test(title);
}
