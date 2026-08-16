import type { GitHubUserProfile } from '@proofly/shared-types';

interface ProfileSummaryProps {
  profile: GitHubUserProfile;
}

export function ProfileSummary({ profile }: ProfileSummaryProps) {
  return (
    <section className="mb-6 border-y border-[var(--border)] py-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <img
            className="size-14 rounded-[8px] border border-[var(--border)]"
            src={profile.avatarUrl}
            alt={`${profile.login} avatar`}
          />
          <div>
            <a
              className="text-xl font-bold text-[var(--text)] transition hover:text-[var(--accent)]"
              href={profile.profileUrl}
              target="_blank"
              rel="noreferrer"
            >
              {profile.name ?? profile.login}
            </a>
            <p className="font-mono text-xs text-[var(--muted)]">
              @{profile.login}
            </p>
            {profile.bio ? (
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
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
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--border)] pt-3 font-mono text-xs text-[var(--muted)]">
        {profile.location ? <Chip>{profile.location}</Chip> : null}
        {profile.company ? <Chip>{profile.company}</Chip> : null}
        {profile.blog ? <Chip>{profile.blog}</Chip> : null}
        <Chip>Joined {new Date(profile.createdAt).getFullYear()}</Chip>
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span>{children}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 border-l border-[var(--border)] px-4 py-1 text-left first:border-l-0">
      <div className="text-xl font-bold tabular-nums text-[var(--text)]">
        {value}
      </div>
      <div className="technical-label mt-0.5">{label}</div>
    </div>
  );
}
