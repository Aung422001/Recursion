import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { fetchSummary } from '../api/progress';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Spinner, ErrorState } from '../components/States';
import { Button } from '../components/Button';
import { Text } from '../components/Text';
import { LanguageBadge } from '../components/LanguageBadge';
import { AudioSettings } from '../components/AudioSettings';
import { LANGUAGES } from 'shared/constants.js';

export default function Profile() {
  const { data, error, loading, reload } = useApi(fetchSummary);

  if (loading) return <Spinner label="Loading your progress" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { user, level, totals, accuracy, course, languages } = data;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700"
        >
          {user.displayName.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{user.displayName}</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
          <p className="mt-0.5 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <LanguageBadge code={course.target.code} />
            Studying {course.target.name} from {course.source.name}
          </p>
        </div>
      </header>

      <Card className="p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Level {level.level}</p>
            <p className="text-2xl font-extrabold">{level.xp.toLocaleString()} XP</p>
          </div>
          <p className="text-sm text-slate-500">
            {Math.max(0, level.nextLevelXp - level.xp)} XP to level {level.level + 1}
          </p>
        </div>
        <ProgressBar className="mt-3" value={level.progress} max={1} label="Level progress" />
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon="🔥"
          label="Day streak"
          value={user.currentStreak}
          sub={`best ${user.longestStreak}`}
        />
        <StatCard
          icon="📚"
          label="Lessons"
          value={`${totals.lessonsCompleted}/${totals.totalLessons}`}
        />
        <StatCard
          icon="🧩"
          label="Units done"
          value={`${totals.unitsCompleted}/${totals.totalUnits}`}
        />
        <StatCard
          icon="🎯"
          label="Accuracy"
          value={accuracy.overall === null ? '—' : `${Math.round(accuracy.overall * 100)}%`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">Vocabulary</h2>
          <p className="mt-1 text-sm text-slate-500">
            {totals.wordsLearned} of {totals.wordsSeen} words seen are sticking.
          </p>
          <ProgressBar
            className="mt-3"
            value={totals.wordsLearned}
            max={Math.max(1, totals.wordsSeen)}
            label="Words learned"
          />
          <Link to="/words" className="mt-4 inline-block">
            <Button variant="secondary" size="sm">
              See all words
            </Button>
          </Link>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Due for review</h2>
          <p className="mt-1 text-sm text-slate-500">
            {totals.dueCount === 0
              ? 'Nothing due — your schedule is clear.'
              : `${totals.dueCount} word${totals.dueCount === 1 ? '' : 's'} waiting.`}
          </p>
          <Link to="/review" className="mt-4 inline-block">
            <Button size="sm" disabled={totals.dueCount === 0}>
              Start review
            </Button>
          </Link>
        </Card>
      </div>

      <LanguageBreakdown languages={languages} activeTarget={course.target.code} />

      <AudioSettings activeLang={course.target.code} />

      <AccuracyChart daily={accuracy.daily} />
    </div>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <Card className="p-4">
      <p className="text-xl" aria-hidden="true">
        {icon}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}

/** Words tracked in every language studied, not just the active course. */
function LanguageBreakdown({ languages, activeTarget }) {
  if (!languages?.length) return null;
  const max = Math.max(...languages.map((l) => l.words));

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Languages you are learning</h2>
      <p className="mt-1 text-sm text-slate-500">
        {languages.length} language{languages.length === 1 ? '' : 's'} with words in your schedule
      </p>
      <ul className="mt-4 space-y-2">
        {languages.map((lang) => (
          <li key={lang.code} className="flex items-center gap-3">
            <LanguageBadge code={lang.code} />
            <span className="w-28 shrink-0 text-sm font-medium">
              {lang.name}
              {lang.code === activeTarget && (
                <span className="ml-1 text-xs font-semibold text-emerald-700">· active</span>
              )}
            </span>
            <span className="hidden w-24 shrink-0 text-sm text-slate-500 sm:inline">
              <Text lang={lang.code}>{LANGUAGES[lang.code]?.nativeName ?? ''}</Text>
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.max(6, (lang.words / max) * 100)}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
              {lang.words}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** A plain CSS bar chart — a charting library is not worth 40kb for this. */
function AccuracyChart({ daily }) {
  if (!daily?.length) {
    return (
      <Card className="p-5">
        <h2 className="font-semibold">Accuracy over time</h2>
        <p className="mt-1 text-sm text-slate-500">
          Complete a few lessons and your daily accuracy will show up here.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Accuracy over time</h2>
      <p className="mt-1 text-sm text-slate-500">Last {daily.length} active day(s)</p>
      <ul className="mt-5 flex h-40 items-end gap-2">
        {daily.map((day) => {
          const pct = Math.round((day.accuracy ?? 0) * 100);
          return (
            <li key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-semibold tabular-nums text-slate-500">{pct}%</span>
              <div
                className="w-full rounded-t-md bg-emerald-500"
                style={{ height: `${Math.max(4, pct)}%` }}
                title={`${day.date}: ${day.correct}/${day.total} correct across ${day.lessons} lesson(s)`}
              />
              <span className="text-[10px] text-slate-400">{day.date.slice(5)}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
