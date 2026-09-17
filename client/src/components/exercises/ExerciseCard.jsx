import { EXERCISE_TYPES, LANGUAGES } from 'shared/constants.js';
import { Text } from '../Text';
import { SpeakButton } from '../SpeakButton';
import { MultipleChoice } from './MultipleChoice';
import { FillBlank } from './FillBlank';
import { MatchPairs } from './MatchPairs';

const PROMPT_BY_TYPE = {
  [EXERCISE_TYPES.MULTIPLE_CHOICE]: (ex) =>
    `Choose the ${LANGUAGES[ex.answerLang]?.name ?? ''} translation`.trim(),
  [EXERCISE_TYPES.FILL_BLANK]: () => 'Type the translation',
  [EXERCISE_TYPES.MATCH_PAIRS]: () => 'Match the pairs',
};

/** Renders the prompt plus whichever input the exercise type calls for. */
export function ExerciseCard({ exercise, answer, onAnswerChange, locked, onSubmit }) {
  const instruction = PROMPT_BY_TYPE[exercise.type]?.(exercise) ?? 'Answer the question';

  return (
    <div className="animate-pop-in">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{instruction}</p>

      {exercise.type !== EXERCISE_TYPES.MATCH_PAIRS && (
        <div className="mb-6 mt-3">
          <div className="flex items-center gap-2">
            <Text lang={exercise.promptLang} as="p" className="text-3xl font-bold text-slate-900">
              {exercise.prompt}
            </Text>
            <SpeakButton text={exercise.prompt} lang={exercise.promptLang} />
          </div>
          {exercise.promptRomanization && (
            <p className="mt-1 text-sm italic text-slate-400">{exercise.promptRomanization}</p>
          )}
        </div>
      )}
      {exercise.type === EXERCISE_TYPES.MATCH_PAIRS && <div className="mb-6" />}

      {exercise.type === EXERCISE_TYPES.MULTIPLE_CHOICE && (
        <MultipleChoice
          exercise={exercise}
          selected={answer}
          onSelect={onAnswerChange}
          locked={locked}
        />
      )}
      {exercise.type === EXERCISE_TYPES.FILL_BLANK && (
        <FillBlank
          exercise={exercise}
          value={answer ?? ''}
          onChange={onAnswerChange}
          locked={locked}
          onSubmit={onSubmit}
        />
      )}
      {exercise.type === EXERCISE_TYPES.MATCH_PAIRS && (
        <MatchPairs
          exercise={exercise}
          matches={Array.isArray(answer) ? answer : []}
          onChange={onAnswerChange}
          locked={locked}
        />
      )}
    </div>
  );
}
