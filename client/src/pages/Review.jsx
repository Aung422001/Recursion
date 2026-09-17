import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { useSpeech } from '../hooks/useSpeech';
import { fetchDueReviews, submitReview } from '../api/review';
import { MultipleChoice } from '../components/exercises/MultipleChoice';
import { Text } from '../components/Text';
import { SpeakButton } from '../components/SpeakButton';
import { Feedback } from '../components/exercises/Feedback';
import { ProgressBar } from '../components/ProgressBar';
import { Button } from '../components/Button';
import { Spinner, ErrorState, EmptyState } from '../components/States';

export default function Review() {
  const { refreshUser, applyXp } = useAuth();
  const { autoSpeak, resetAutoSpeak } = useSpeech();
  const { data, error, loading, reload } = useApi(() => fetchDueReviews(10));

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [done, setDone] = useState(false);

  const exercises = data?.exercises ?? [];
  const exercise = exercises[index];

  useEffect(() => {
    if (exercise?.prompt) autoSpeak(exercise.prompt, exercise.promptLang);
  }, [exercise, autoSpeak]);

  const check = useCallback(async () => {
    if (!exercise || checking) return;
    const tries = attempts + 1;
    setAttempts(tries);
    setChecking(true);
    try {
      const res = await submitReview({
        conceptId: exercise.conceptId,
        answer,
        direction: exercise.direction,
        attempts: tries,
      });
      applyXp(res.totalXp);
      setResult(res);
      if (tries === 1) {
        setStats((s) => ({ correct: s.correct + (res.correct ? 1 : 0), total: s.total + 1 }));
      }
    } catch (err) {
      setResult({ correct: false, correctAnswer: null, error: err.message });
    } finally {
      setChecking(false);
    }
  }, [exercise, checking, attempts, answer, applyXp]);

  const advance = () => {
    setResult(null);
    setAnswer('');
    setAttempts(0);
    resetAutoSpeak();
    if (index + 1 < exercises.length) setIndex(index + 1);
    else {
      setDone(true);
      refreshUser();
    }
  };

  if (loading) return <Spinner label="Loading your reviews" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  if (!exercises.length) {
    return (
      <EmptyState
        icon="✅"
        title="Nothing due right now"
        description="Spaced repetition schedules each word for the day you are about to forget it. Finish another lesson in this course, or come back tomorrow."
        action={
          <Link to="/">
            <Button>Back to lessons</Button>
          </Link>
        }
      />
    );
  }

  if (done) {
    const pct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
    return (
      <div className="mx-auto max-w-md">
        <div className="card animate-pop-in p-8 text-center">
          <div className="text-5xl" aria-hidden="true">
            🔁
          </div>
          <h1 className="mt-4 text-2xl font-extrabold">Review done</h1>
          <p className="mt-1 text-slate-600">
            {stats.correct} of {stats.total} correct ({pct}%)
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button size="lg" onClick={reload}>
              Check for more
            </Button>
            <Link to="/">
              <Button variant="ghost" className="w-full">
                Back to lessons
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/"
          className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Leave review"
        >
          ✕
        </Link>
        <ProgressBar
          value={index}
          max={exercises.length}
          tone="amber"
          label={`Review ${index + 1} of ${exercises.length}`}
        />
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">
          {index + 1}/{exercises.length}
        </span>
      </div>

      <div className="card p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">
          {/* repetitions is SM-2's consecutive-correct count, not a view count. */}
          Review ·{' '}
          {exercise.repetitions === 0
            ? 'still bedding in'
            : `${exercise.repetitions} correct in a row`}
        </p>
        <div className="mb-6 mt-3">
          <div className="flex items-center gap-2">
            <Text lang={exercise.promptLang} as="p" className="text-3xl font-bold">
              {exercise.prompt}
            </Text>
            <SpeakButton text={exercise.prompt} lang={exercise.promptLang} />
          </div>
          {exercise.promptRomanization && (
            <p className="mt-1 text-sm italic text-slate-400">{exercise.promptRomanization}</p>
          )}
        </div>
        <MultipleChoice
          key={index}
          exercise={exercise}
          selected={answer}
          onSelect={setAnswer}
          locked={Boolean(result) || checking}
        />
      </div>

      <div className="mt-5">
        {result ? (
          <Feedback
            result={result}
            answerLang={exercise.answerLang}
            onContinue={advance}
            continueLabel={index + 1 === exercises.length ? 'Finish' : 'Continue'}
          />
        ) : (
          <Button size="lg" className="w-full" onClick={check} disabled={!answer} loading={checking}>
            Check
          </Button>
        )}
      </div>

      {result?.nextDue && (
        <p className="mt-3 text-center text-sm text-slate-500">
          {/* A missed word has interval 0 — it returns this session, not in "0 days". */}
          {result.intervalDays > 0
            ? `Next review in ${result.intervalDays} day${result.intervalDays === 1 ? '' : 's'}`
            : 'Coming back again shortly'}
        </p>
      )}
    </div>
  );
}
