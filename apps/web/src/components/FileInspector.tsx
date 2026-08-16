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
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Proofly read {report.analyzedCount} of the {report.totalFiles} files in
        the repository tree. Everything below is what the score was actually
        computed from.
      </p>

      <div className="flex w-fit gap-1 rounded-full bg-slate-100 dark:bg-slate-800 p-1">
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
              <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {entry.count}
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                {entry.reason}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="max-h-72 overflow-y-auto rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-2">
        {files.map((file) => (
          <li
            key={file.path}
            className="grid gap-0.5 rounded-xl px-3 py-2 hover:bg-white dark:hover:bg-slate-800"
          >
            <div className="flex items-baseline justify-between gap-3">
              <a
                className="truncate font-mono text-xs text-slate-900 dark:text-slate-100 hover:text-aurora dark:hover:text-indigo-300"
                href={`${repository.htmlUrl}/blob/${repository.defaultBranch}/${file.path}`}
                target="_blank"
                rel="noreferrer"
              >
                {file.path}
              </a>
              {file.sizeBytes !== null ? (
                <span className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                  {formatBytes(file.sizeBytes)}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {file.reason}
            </p>
          </li>
        ))}
      </ul>

      {tab === 'ignored' && report.ignoredListTruncated ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">
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
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
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
