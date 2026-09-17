import { Button } from '../components/Button';

/** The end-of-lesson card: score, XP earned, and where to go next. */
export function LessonSummary({ summary, lesson, onAgain, onDone }) {
  const { score, correctCount, totalCount, perfect, xpAwarded } = summary.completion;
  const pct = Math.round(score * 100);

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="card animate-pop-in p-8">
        <div className="text-5xl" aria-hidden="true">
          {perfect ? '🏆' : pct >= 60 ? '🎉' : '💪'}
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">
          {perfect ? 'Perfect lesson!' : pct >= 60 ? 'Lesson complete!' : 'Keep practising'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{lesson.title}</p>

        <dl className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Score" value={`${pct}%`} />
          <Stat label="First try" value={`${correctCount}/${totalCount}`} />
          <Stat label="XP" value={`+${xpAwarded}`} tone="emerald" />
        </dl>

        <p className="mt-6 text-sm text-slate-600">
          These words are now in your review queue — come back tomorrow to lock them in.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Button size="lg" onClick={onDone}>
            Continue
          </Button>
          <Button variant="ghost" onClick={onAgain}>
            Practice again
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-xl font-bold ${tone === 'emerald' ? 'text-emerald-600' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
