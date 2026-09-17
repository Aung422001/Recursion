import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { fetchUnits } from '../api/lessons';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Spinner, ErrorState, EmptyState } from '../components/States';
import { Button } from '../components/Button';
import { LanguageBadge } from '../components/LanguageBadge';

const UNIT_COLORS = {
  emerald: 'bg-emerald-100 text-emerald-700',
  sky: 'bg-sky-100 text-sky-700',
  rose: 'bg-rose-100 text-rose-700',
  amber: 'bg-amber-100 text-amber-700',
  violet: 'bg-violet-100 text-violet-700',
  cyan: 'bg-cyan-100 text-cyan-700',
  orange: 'bg-orange-100 text-orange-700',
  teal: 'bg-teal-100 text-teal-700',
};

export default function UnitMap() {
  const { user, dueCount } = useAuth();
  const { data, error, loading, reload } = useApi(fetchUnits);

  if (loading) return <Spinner label="Loading your course" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const units = data.units;
  const course = data.course;
  if (!units.length) {
    return (
      <EmptyState
        icon="📚"
        title="No lessons yet"
        description="The course has not been seeded. Run `npm run seed` from the project root and reload."
      />
    );
  }

  const totalLessons = units.reduce((n, u) => n + u.lessonCount, 0);
  const doneLessons = units.reduce((n, u) => n + u.completedCount, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {user?.displayName ? `Keep going, ${user.displayName.split(' ')[0]}` : 'Your course'}
          </h1>
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <LanguageBadge code={course.target.code} />
            {course.target.name} from {course.source.name} · {doneLessons} of {totalLessons} lessons
            complete
          </p>
        </div>
        {dueCount > 0 && (
          <Link to="/review">
            <Button>🔁 Review {dueCount} word{dueCount === 1 ? '' : 's'}</Button>
          </Link>
        )}
      </header>

      <ProgressBar value={doneLessons} max={totalLessons} label="Course progress" />

      <Link
        to="/alphabet"
        className="card flex items-center gap-4 p-4 transition-colors hover:bg-slate-50"
      >
        <span aria-hidden="true" className="text-2xl">
          🔤
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Learn the script first</span>
          <span className="block text-sm text-slate-500">
            The vowels and consonants of {course.target.name}, with sounds and examples.
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-emerald-700">Open</span>
      </Link>

      <ol className="space-y-4">
        {units.map((unit) => (
          <li key={unit.id}>
            <UnitRow unit={unit} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function UnitRow({ unit }) {
  const complete = unit.lessonCount > 0 && unit.completedCount === unit.lessonCount;

  return (
    <Card className={unit.unlocked ? '' : 'opacity-60'}>
      <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-4">
        <span
          aria-hidden="true"
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl ${
            UNIT_COLORS[unit.color] ?? UNIT_COLORS.emerald
          }`}
        >
          {unit.unlocked ? (unit.icon ?? '📘') : '🔒'}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 font-bold">
            {unit.title}
            {complete && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Complete
              </span>
            )}
          </h2>
          <p className="truncate text-sm text-slate-500">
            {unit.unlocked ? unit.description : 'Finish the previous unit to unlock'}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-slate-500">
          {unit.completedCount}/{unit.lessonCount}
        </span>
      </div>

      <ul className="divide-y divide-slate-100">
        {unit.lessons.map((lesson) => (
          <li key={lesson.id}>
            <LessonRow lesson={lesson} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LessonRow({ lesson }) {
  const content = (
    <div className="flex items-center gap-3 px-5 py-3">
      <span
        aria-hidden="true"
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm ${
          lesson.completed
            ? 'bg-emerald-500 text-white'
            : lesson.unlocked
              ? 'border-2 border-emerald-500 text-emerald-600'
              : 'bg-slate-200 text-slate-400'
        }`}
      >
        {lesson.completed ? '✓' : lesson.unlocked ? lesson.order : '🔒'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{lesson.title}</p>
        <p className="text-xs text-slate-500">
          {lesson.conceptCount} words
          {lesson.bestScore !== null && ` · best ${Math.round(lesson.bestScore * 100)}%`}
        </p>
      </div>
      {lesson.unlocked && (
        <span className="shrink-0 text-sm font-semibold text-emerald-700">
          {lesson.completed ? 'Practice' : 'Start'}
        </span>
      )}
    </div>
  );

  if (!lesson.unlocked) {
    return (
      <div className="cursor-not-allowed" aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link
      to={`/lesson/${lesson.slug}`}
      className="block transition-colors hover:bg-slate-50 focus-visible:bg-slate-50"
    >
      {content}
    </Link>
  );
}
