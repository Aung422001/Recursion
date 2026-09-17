import { Button } from '../Button';
import { Text } from '../Text';
import { SpeakButton } from '../SpeakButton';

/** The right/wrong banner that slides up under a checked answer. */
export function Feedback({ result, onContinue, onRetry, continueLabel = 'Continue', answerLang }) {
  if (!result) return null;
  const { correct, correctAnswer, correctRomanization, xpAwarded } = result;

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`animate-pop-in rounded-2xl border-2 p-4 sm:p-5 ${
        correct ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p
            className={`flex items-center gap-2 font-bold ${
              correct ? 'text-emerald-800' : 'text-rose-800'
            }`}
          >
            <span aria-hidden="true">{correct ? '✅' : '❌'}</span>
            {correct ? 'Correct!' : 'Not quite'}
            {correct && xpAwarded > 0 && (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">
                +{xpAwarded} XP
              </span>
            )}
          </p>
          {!correct && correctAnswer && (
            <p className="mt-1 text-sm text-rose-900">
              Answer:{' '}
              <Text lang={answerLang} className="font-semibold">
                {correctAnswer}
              </Text>
              {correctRomanization && (
                <span className="ml-2 italic text-rose-700">{correctRomanization}</span>
              )}
              <SpeakButton text={correctAnswer} lang={answerLang} size="sm" className="ml-1" />
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {!correct && onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          )}
          <Button
            variant={correct ? 'primary' : 'danger'}
            onClick={onContinue}
            autoFocus
          >
            {continueLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
