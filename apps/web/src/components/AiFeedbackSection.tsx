import type {
  AiFeedbackPoint,
  AiGeneratedFeedback,
  EvidenceReference,
} from '@proofly/shared-types';

export function AiFeedbackSection({
  feedback,
}: {
  feedback: AiGeneratedFeedback;
}) {
  return (
    <section className="border-b-2 border-[var(--line)] bg-[var(--brand-soft)] px-5 py-6 text-[var(--ink)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-mono text-[var(--brand)]">
            AI feedback &amp; scoring
          </p>
          <h3 className="display mt-1 text-2xl">Hybrid assessment</h3>
        </div>
        <span className="pill bg-[var(--surface)] text-[var(--muted)]">
          {feedback.provider} · {feedback.model}
        </span>
      </div>

      <HybridScoreCard feedback={feedback} />

      <p className="mt-4 max-w-measure text-base leading-7">
        {feedback.summary}
      </p>
      <p className="mt-3 max-w-measure text-sm leading-6 text-[var(--muted)]">
        {feedback.careerNarrative}
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <FeedbackList title="What stands out" points={feedback.strengths} />
        <FeedbackList
          title="What to improve next"
          points={feedback.improvements}
          showAction
        />
      </div>

      <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
        {feedback.disclaimer}
      </p>
    </section>
  );
}

function HybridScoreCard({ feedback }: { feedback: AiGeneratedFeedback }) {
  const { scoring } = feedback;

  return (
    <div className="card-inset mt-5 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <ScorePart
          label="Deterministic"
          score={scoring.deterministicScore}
          weight={scoring.deterministicWeight}
        />
        <ScorePart
          label="Gemini"
          score={scoring.aiScore}
          weight={scoring.aiWeight}
        />
        <ScorePart label="Final hybrid" score={scoring.finalScore} emphasis />
      </div>

      <details className="mt-4 border-t-2 border-dashed border-[var(--hair)] pt-3">
        <summary className="focus-control cursor-pointer text-sm font-semibold text-[var(--brand)]">
          Gemini category scores
        </summary>
        <ul className="mt-3 grid gap-3">
          {scoring.categories.map((category) => (
            <li
              key={category.category}
              className="border-b border-[var(--hair)] pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold">{category.label}</p>
                <span className="font-mono text-xs font-bold tabular-nums">
                  {category.score.toFixed(1)}/{category.maxScore.toFixed(1)}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                {category.rationale}
              </p>
              <EvidenceChips
                title={category.category}
                evidence={category.evidence}
              />
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function ScorePart({
  label,
  score,
  weight,
  emphasis = false,
}: {
  label: string;
  score: number;
  weight?: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-[var(--radius)] border-2 border-[var(--line)] px-3 py-2 ${
        emphasis
          ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
          : 'bg-[var(--surface)]'
      }`}
    >
      <p className="label-mono">{label}</p>
      <p className="display mt-1 text-2xl tabular-nums">
        {score.toFixed(1)}
        <span className="ml-1 text-sm font-normal">/10</span>
      </p>
      {weight !== undefined ? (
        <p className="mt-0.5 text-xs opacity-70">
          {Math.round(weight * 100)}% of final score
        </p>
      ) : null}
    </div>
  );
}

function FeedbackList({
  title,
  points,
  showAction = false,
}: {
  title: string;
  points: (AiFeedbackPoint & { suggestedAction?: string })[];
  showAction?: boolean;
}) {
  return (
    <div className="card-inset p-4">
      <h4 className="label-mono text-[var(--ink)]">{title}</h4>
      {points.length > 0 ? (
        <ul className="mt-3 grid gap-4">
          {points.map((point) => (
            <li key={`${title}-${point.title}`}>
              <p className="text-sm font-semibold">{point.title}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                {point.explanation}
              </p>
              {showAction && point.suggestedAction ? (
                <p className="mt-2 text-sm leading-6">
                  <span className="font-semibold">Next step:</span>{' '}
                  {point.suggestedAction}
                </p>
              ) : null}
              <EvidenceChips title={point.title} evidence={point.evidence} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No grounded items were generated.
        </p>
      )}
    </div>
  );
}

function EvidenceChips({
  title,
  evidence,
}: {
  title: string;
  evidence: EvidenceReference[];
}) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {evidence.map((reference) => (
        <li
          key={`${title}-${reference.label}-${reference.path ?? ''}-${reference.line ?? ''}`}
          className="pill bg-[var(--surface)] font-mono text-[var(--muted)]"
        >
          {reference.path
            ? `${reference.path}${reference.line ? `:${reference.line}` : ''}`
            : reference.label}
        </li>
      ))}
    </ul>
  );
}
