import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { useSpeech } from '../hooks/useSpeech';
import { fetchAlphabetDrill, submitAlphabetAttempt } from '../api/alphabet';
import { ProgressBar } from '../components/ProgressBar';
import { Button } from '../components/Button';
import { Text } from '../components/Text';
import { SpeakButton } from '../components/SpeakButton';
import { Spinner, ErrorState, EmptyState } from '../components/States';

/** A quick round of "which sound is this letter?" over the script. */
export default function AlphabetPractice() {
  const { applyXp, refreshUser } = useAuth();
  const { autoSpeak, resetAutoSpeak } = useSpeech();
  const { data, error, loading, reload } = useApi(() => fetchAlphabetDrill(10));

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [done, setDone] = useState(false);

  const exercises = data?.exercises ?? [];
  const exercise = exercises[index];
  const lang = data?.lang?.code;

  // Say the letter (via its example word) as it appears, if autoplay is on.
  useEffect(() => {
    if (exercise && lang) autoSpeak(exercise.exampleWord ?? exercise.char, lang);
  }, [exercise, lang, autoSpeak]);

  const check = useCallback(async () => {
    if (!exercise || checking || !answer) return;
    const tries = attempts + 1;
    setAttempts(tries);
    setChecking(true);
    try {
      const res = await submitAlphabetAttempt({
        lang,
        char: exercise.char,
        answer,
        attempts: tries,
      });
      applyXp(res.totalXp);
      setResult(res);
      if (tries === 1) {
        setScore((s) => ({ correct: s.correct + (res.correct ? 1 : 0), total: s.total + 1 }));
      }
    } catch (err) {
      setResult({ correct: false, correctAnswer: null, error: err.message });
    } finally {
      setChecking(false);
    }
  }, [exercise, checking, answer, attempts, lang, applyXp]);

  const advance = () => {
    setResult(null);
    setAnswer(null);
    setAttempts(0);
    resetAutoSpeak();
    if (index + 1 < exercises.length) setIndex(index + 1);
    else {
      setDone(true);
      refreshUser();
    }
  };

  if (loading) return <Spinner label="Building a practice round" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  if (!exercises.length) {
    return (
      <EmptyState
        icon="🔤"
        title="No script practice available"
        description="This language has no alphabet recorded yet."
      />
    );
  }

  if (done) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <div className="mx-auto max-w-md">
        <div className="card animate-pop-in p-8 text-center">
          <div className="text-5xl" aria-hidden="true">
            {pct === 100 ? '🏆' : '🔤'}
          </div>
          <h1 className="mt-4 text-2xl font-extrabold">Script practice done</h1>
          <p className="mt-1 text-slate-600">
            {score.correct} of {score.total} correct ({pct}%)
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              size="lg"
              onClick={() => {
                setIndex(0);
                setDone(false);
                setScore({ correct: 0, total: 0 });
                resetAutoSpeak();
                reload();
              }}
            >
              Another round
            </Button>
            <Link to="/alphabet">
              <Button variant="ghost" className="w-full">
                Back to the chart
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
          to="/alphabet"
          className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Leave practice"
        >
          ✕
        </Link>
        <ProgressBar
          value={index}
          max={exercises.length}
          tone="sky"
          label={`Letter ${index + 1} of ${exercises.length}`}
        />
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">
          {index + 1}/{exercises.length}
        </span>
      </div>

      <div className="card p-6 text-center sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
          Which sound is this {exercise.letterType}?
        </p>

        <div className="my-6 flex items-center justify-center gap-3">
          <Text lang={lang} className="text-7xl font-bold leading-none">
            {exercise.char}
          </Text>
          <SpeakButton text={exercise.exampleWord ?? exercise.char} lang={lang} size="lg" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Choose the sound">
          {exercise.options.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={answer === option}
              disabled={Boolean(result) || checking}
              onClick={() => setAnswer(option)}
              className={`rounded-xl border-2 px-4 py-3 text-lg transition-colors disabled:cursor-not-allowed ${
                answer === option
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {result ? (
          <div
            role="status"
            aria-live="assertive"
            className={`animate-pop-in rounded-2xl border-2 p-4 ${
              result.correct ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p
                  className={`font-bold ${result.correct ? 'text-emerald-800' : 'text-rose-800'}`}
                >
                  {result.correct ? '✅ Correct!' : '❌ Not quite'}
                  {result.correct && result.xpAwarded > 0 && (
                    <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">
                      +{result.xpAwarded} XP
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  <Text lang={lang} className="font-semibold">
                    {exercise.char}
                  </Text>{' '}
                  is <span className="font-semibold">{result.letterName}</span>, the sound{' '}
                  <span className="font-semibold">{result.correctAnswer}</span>
                  {result.exampleWord && (
                    <>
                      {' '}
                      — as in <Text lang={lang}>{result.exampleWord}</Text>
                      {result.exampleMeaning && ` (${result.exampleMeaning})`}
                    </>
                  )}
                </p>
              </div>
              <Button variant={result.correct ? 'primary' : 'danger'} onClick={advance} autoFocus>
                {index + 1 === exercises.length ? 'Finish' : 'Continue'}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="lg" className="w-full" onClick={check} disabled={!answer} loading={checking}>
            Check
          </Button>
        )}
      </div>
    </div>
  );
}
