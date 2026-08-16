import { useState } from 'react';
import type {
  FileInspectionReport,
  GitHubRepository,
} from '@proofly/shared-types';

interface FileInspectorProps {
  report: FileInspectionReport;
  repository: GitHubRepository;
}

type Tab = 'analyzed' | 'ignored';

export function FileInspector({ report, repository }: FileInspectorProps) {
  const [tab, setTab] = useState<Tab>('analyzed');
  const files = report.files.filter((file) => file.status === tab);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-[var(--muted)]">
        Proofly read {report.analyzedCount} of the {report.totalFiles} files in
        the repository tree. Everything below is what the score was actually
        computed from.
      </p>

      <div className="flex w-fit gap-1 border-b border-[var(--border)]">
        <TabButton
          active={tab === 'analyzed'}
          onClick={() => setTab('analyzed')}
        >
          Analyzed ({report.analyzedCount})
        </TabButton>
        <TabButton active={tab === 'ignored'} onClick={() => setTab('ignored')}>
          Ignored ({report.ignoredCount})
        </TabButton>
      </div>

      {tab === 'ignored' && report.ignoredReasons.length > 0 ? (
        <ul className="grid gap-1.5">
          {report.ignoredReasons.map((entry) => (
            <li key={entry.reason} className="flex gap-3 text-sm">
              <span className="w-10 shrink-0 text-right font-mono font-semibold tabular-nums text-[var(--text)]">
                {entry.count}
              </span>
              <span className="text-[var(--muted)]">{entry.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto border-y border-[var(--border)]">
        {files.map((file) => (
          <li
            key={file.path}
            className="grid gap-0.5 px-2 py-2.5 transition hover:bg-[var(--surface-subtle)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <a
                className="truncate font-mono text-xs text-[var(--text)] hover:text-[var(--accent)]"
                href={`${repository.htmlUrl}/blob/${repository.defaultBranch}/${file.path}`}
                target="_blank"
                rel="noreferrer"
              >
                {file.path}
              </a>
              {file.sizeBytes !== null ? (
                <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--muted)]">
                  {formatBytes(file.sizeBytes)}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[var(--muted)]">{file.reason}</p>
          </li>
        ))}
      </ul>

      {tab === 'ignored' && report.ignoredListTruncated ? (
        <p className="text-xs text-[var(--muted)]">
          Showing the first {files.length} ignored files. The counts above cover
          all {report.ignoredCount}.
        </p>
      ) : null}
    </div>
  );
}

function TabButton({
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
      onClick={onClick}
      aria-pressed={active}
      className={`focus-control border-b-2 px-3 py-2 font-mono text-xs font-semibold transition ${
        active
          ? 'border-[var(--accent)] text-[var(--text)]'
          : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
      }`}
    >
      {children}
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1000) {
    return `${bytes} B`;
  }

  return `${(bytes / 1000).toFixed(1)} KB`;
}
