import type { GitHubUserProfile } from '@proofly/shared-types';

interface ProfileSummaryProps {
  profile: GitHubUserProfile;
}

export function ProfileSummary({ profile }: ProfileSummaryProps) {
  return (
    <section className="mb-6 border-b border-[var(--border)] pb-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <img
            className="size-12 rounded-full border border-[var(--border)]"
            src={profile.avatarUrl}
            alt={`${profile.login} avatar`}
          />
          <div>
            <a
              className="text-lg font-semibold text-[var(--text)] hover:text-[var(--accent)] hover:underline"
              href={profile.profileUrl}
              target="_blank"
              rel="noreferrer"
            >
              {profile.name ?? profile.login}
            </a>
            <p className="text-sm text-[var(--muted)]">@{profile.login}</p>
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
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
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
      <div className="text-lg font-semibold tabular-nums text-[var(--text)]">
        {value}
      </div>
      <div className="field-label mt-0.5">{label}</div>
    </div>
  );
}
