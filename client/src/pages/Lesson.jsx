import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { EXERCISE_TYPES } from 'shared/constants.js';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { useSpeech } from '../hooks/useSpeech';
import { fetchLesson, submitAttempt, completeLesson } from '../api/lessons';
import { ExerciseCard } from '../components/exercises/ExerciseCard';
import { Feedback } from '../components/exercises/Feedback';
import { ProgressBar } from '../components/ProgressBar';
import { Button } from '../components/Button';
import { Spinner, ErrorState } from '../components/States';
import { LessonSummary } from './LessonSummary';

const emptyAnswer = (exercise) => (exercise?.type === EXERCISE_TYPES.MATCH_PAIRS ? [] : '');

export default function Lesson() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { refreshUser, applyXp } = useAuth();
  const { autoSpeak, resetAutoSpeak } = useSpeech();
  const { data, error, loading, reload } = useApi(() => fetchLesson(slug), [slug]);

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [summary, setSummary] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  // Attempts per exercise feed the SM-2 grade: first-try recall is worth more
  // than the third guess at the same word.
  const attempts = useRef({});
  const firstTryCorrect = useRef(0);
  const startedAt = useRef(Date.now());

  const lesson = data?.lesson;
  const exercise = lesson?.exercises[index];

  // Speak the prompt as it appears, so the learner hears the word before
  // answering rather than only seeing it.
  useEffect(() => {
    if (exercise?.prompt) autoSpeak(exercise.prompt, exercise.promptLang);
  }, [exercise, autoSpeak]);

  const check = useCallback(async () => {
    if (!exercise || checking) return;
    const tries = (attempts.current[index] ?? 0) + 1;
    attempts.current[index] = tries;

    setChecking(true);
    setSubmitError(null);
    try {
      const res = await submitAttempt(slug, {
        exerciseIndex: exercise.index,
        answer,
        attempts: tries,
      });
      if (res.correct && tries === 1) firstTryCorrect.current += 1;
      applyXp(res.totalXp);
      setResult(res);
    } catch (err) {
      setSubmitError(err.message ?? 'Could not check that answer');
      attempts.current[index] = tries - 1; // a network failure is not a wrong answer
    } finally {
      setChecking(false);
    }
  }, [exercise, checking, index, slug, answer, applyXp]);

  const retry = () => {
    setResult(null);
    setAnswer(emptyAnswer(exercise));
  };

  const advance = async () => {
    const next = index + 1;
    setResult(null);
    resetAutoSpeak();

    if (next < lesson.exercises.length) {
      setIndex(next);
      setAnswer(emptyAnswer(lesson.exercises[next]));
      return;
    }

    // Finished: record the completion, then show the summary card.
    try {
      const res = await completeLesson(slug, {
        correctCount: firstTryCorrect.current,
        totalCount: lesson.exercises.length,
        durationMs: Date.now() - startedAt.current,
      });
      setSummary(res);
      refreshUser();
    } catch (err) {
      setSubmitError(err.message ?? 'Could not save your progress');
    }
  };

  if (loading) return <Spinner label="Loading lesson" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  if (summary) {
    return (
      <LessonSummary
        summary={summary}
        lesson={lesson}
        onAgain={() => {
          attempts.current = {};
          firstTryCorrect.current = 0;
          startedAt.current = Date.now();
          setSummary(null);
          setIndex(0);
          setAnswer(emptyAnswer(lesson.exercises[0]));
        }}
        onDone={() => navigate('/')}
      />
    );
  }

  const answered =
    exercise.type === EXERCISE_TYPES.MATCH_PAIRS
      ? Array.isArray(answer) && answer.length === exercise.pairs.length
      : String(answer ?? '').trim().length > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/"
          className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Leave lesson"
        >
          ✕
        </Link>
        <ProgressBar
          value={index + (result ? 1 : 0)}
          max={lesson.exercises.length}
          label={`Exercise ${index + 1} of ${lesson.exercises.length}`}
        />
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">
          {index + 1}/{lesson.exercises.length}
        </span>
      </div>

      <div className="card p-6 sm:p-8">
        <ExerciseCard
          key={index}
          exercise={exercise}
          answer={answer}
          onAnswerChange={setAnswer}
          locked={Boolean(result) || checking}
          onSubmit={check}
        />
      </div>

      {submitError && (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {submitError}
        </p>
      )}

      <div className="mt-5">
        {result ? (
          <Feedback
            result={result}
            answerLang={exercise.answerLang}
            onContinue={advance}
            onRetry={retry}
            continueLabel={index + 1 === lesson.exercises.length ? 'Finish' : 'Continue'}
          />
        ) : (
          <Button
            size="lg"
            className="w-full"
            onClick={check}
            disabled={!answered}
            loading={checking}
          >
            Check
          </Button>
        )}
      </div>
    </div>
  );
}
