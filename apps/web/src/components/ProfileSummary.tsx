import type { GitHubUserProfile } from '@proofly/shared-types';

interface ProfileSummaryProps {
  profile: GitHubUserProfile;
}

export function ProfileSummary({ profile }: ProfileSummaryProps) {
  return (
    <section className="mb-6 rounded-3xl border border-white/80 bg-white/85 p-6 shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <img
            className="size-16 rounded-2xl border border-slate-200 dark:border-slate-700"
            src={profile.avatarUrl}
            alt={`${profile.login} avatar`}
          />
          <div>
            <a
              className="text-2xl font-bold text-slate-950 hover:text-aurora dark:text-white dark:hover:text-indigo-300"
              href={profile.profileUrl}
              target="_blank"
              rel="noreferrer"
            >
              {profile.name ?? profile.login}
            </a>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              @{profile.login}
            </p>
            {profile.bio ? (
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                {profile.bio}
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Repos" value={profile.publicRepos} />
          <Stat label="Followers" value={profile.followers} />
          <Stat label="Following" value={profile.following} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
        {profile.location ? <Chip>{profile.location}</Chip> : null}
        {profile.company ? <Chip>{profile.company}</Chip> : null}
        {profile.blog ? <Chip>{profile.blog}</Chip> : null}
        <Chip>Joined {new Date(profile.createdAt).getFullYear()}</Chip>
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white dark:bg-slate-800">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-300 dark:text-slate-400">
        {label}
      </div>
    </div>
  );
}
