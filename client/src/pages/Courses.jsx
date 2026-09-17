import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LANGUAGES, LANGUAGE_CODES } from 'shared/constants.js';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { fetchCourses, setActiveCourse } from '../api/courses';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Text } from '../components/Text';
import { LanguageBadge, languageLabel } from '../components/LanguageBadge';
import { Spinner, ErrorState } from '../components/States';

/**
 * The course picker. With ten languages there are ninety pairs, which is far
 * too many to list flat — so the learner picks the two sides instead, and the
 * courses they have already started are surfaced separately.
 */
export default function Courses() {
  const { user, setUser, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(fetchCourses);

  const [source, setSource] = useState(user?.sourceLang ?? 'en');
  const [target, setTarget] = useState(user?.targetLang ?? 'my');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(null);

  const inProgress = useMemo(
    () => (data?.courses ?? []).filter((c) => c.started).sort((a, b) => b.wordsSeen - a.wordsSeen),
    [data]
  );

  if (loading) return <Spinner label="Loading courses" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const sameLanguage = source === target;

  const start = async (from = source, to = target) => {
    setBusy(true);
    setFailed(null);
    try {
      const res = await setActiveCourse(from, to);
      setUser(res.user);
      refreshUser();
      navigate('/');
    } catch (err) {
      setFailed(err.message ?? 'Could not switch course');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Choose a course</h1>
        <p className="text-sm text-slate-500">
          {data.courses.length} courses across {LANGUAGE_CODES.length} languages — pick any two.
        </p>
      </header>

      {failed && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {failed}
        </p>
      )}

      <Card className="p-5">
        <div className="grid gap-5 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <LanguageSelect
            id="source"
            label="I speak"
            value={source}
            onChange={setSource}
            exclude={target}
          />
          <div className="hidden pb-3 text-center text-xl text-slate-400 sm:block" aria-hidden="true">
            →
          </div>
          <LanguageSelect
            id="target"
            label="I want to learn"
            value={target}
            onChange={setTarget}
            exclude={source}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => start()} disabled={sameLanguage} loading={busy}>
            {user?.sourceLang === source && user?.targetLang === target
              ? 'Continue this course'
              : `Start ${LANGUAGES[source].name} → ${LANGUAGES[target].name}`}
          </Button>
          {sameLanguage && (
            <p className="text-sm text-slate-500">Pick two different languages.</p>
          )}
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Switching is free and nothing is lost — each course keeps its own streak of words and
          its own review schedule.
        </p>
      </Card>

      {inProgress.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Courses you have started</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {inProgress.map((course) => (
              <li key={course.slug}>
                <CourseCard course={course} onOpen={() => start(course.source.code, course.target.code)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LanguageSelect({ id, label, value, onChange, exclude }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {LANGUAGE_CODES.map((code) => (
          <option key={code} value={code} disabled={code === exclude}>
            {languageLabel(code)}
          </option>
        ))}
      </select>
    </div>
  );
}

function CourseCard({ course, onOpen }) {
  return (
    <Card className={`p-4 ${course.active ? 'ring-2 ring-emerald-500' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <LanguageBadge code={course.target.code} />
            <Text lang={course.target.code}>{course.target.nativeName}</Text>
          </p>
          <p className="text-sm text-slate-500">
            from {course.source.name}
            {course.active && <span className="ml-2 font-semibold text-emerald-700">· active</span>}
          </p>
        </div>
        <Button size="sm" variant={course.active ? 'secondary' : 'primary'} onClick={onOpen}>
          {course.active ? 'Continue' : 'Switch'}
        </Button>
      </div>
      <dl className="mt-3 flex gap-5 text-sm">
        <div>
          <dt className="text-slate-500">Words</dt>
          <dd className="font-semibold tabular-nums">{course.wordsSeen}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Lessons</dt>
          <dd className="font-semibold tabular-nums">{course.lessonsCompleted}</dd>
        </div>
      </dl>
    </Card>
  );
}
