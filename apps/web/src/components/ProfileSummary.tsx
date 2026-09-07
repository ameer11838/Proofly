import type { GitHubUserProfile } from '@proofly/shared-types';

interface ProfileSummaryProps {
  profile: GitHubUserProfile;
}

export function ProfileSummary({ profile }: ProfileSummaryProps) {
  return (
    <section className="card mb-8 p-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <img
            className="size-14 rounded-full border-2 border-[var(--line)]"
            src={profile.avatarUrl}
            alt={`${profile.login} avatar`}
          />
          <div>
            <a
              className="display text-2xl text-[var(--ink)] underline-offset-4 hover:text-[var(--brand)] hover:underline"
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
      <div className="mt-4 flex flex-wrap gap-2 border-t-2 border-dashed border-[var(--hair)] pt-4">
        {profile.location ? <Chip>{profile.location}</Chip> : null}
        {profile.company ? <Chip>{profile.company}</Chip> : null}
        {profile.blog ? <Chip>{profile.blog}</Chip> : null}
        <Chip>Joined {new Date(profile.createdAt).getFullYear()}</Chip>
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="pill bg-[var(--surface-2)]">{children}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-inset min-w-20 px-3 py-1.5 text-left">
      <div className="display text-xl tabular-nums text-[var(--ink)]">
        {value}
      </div>
      <div className="label-mono mt-0.5">{label}</div>
    </div>
  );
}
