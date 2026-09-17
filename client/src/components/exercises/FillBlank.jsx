import { useEffect, useRef } from 'react';
import { LANGUAGES } from 'shared/constants.js';
import { Text } from '../Text';

export function FillBlank({ exercise, value, onChange, locked, onSubmit }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!locked) inputRef.current?.focus();
  }, [locked, exercise]);

  return (
    <div>
      {exercise.sentence && (
        <p className="mb-4 text-center text-xl">
          <Text lang={exercise.promptLang}>{exercise.sentence.split('___')[0]}</Text>
          <span className="mx-1 border-b-2 border-dashed border-slate-400 px-6 text-transparent">
            answer
          </span>
        </p>
      )}
      <label className="label" htmlFor="fill-blank-answer">
        Type the translation in {LANGUAGES[exercise.answerLang]?.name ?? exercise.answerLang}
      </label>
      <input
        id="fill-blank-answer"
        ref={inputRef}
        className="input text-lg"
        lang={exercise.answerLang}
        dir={LANGUAGES[exercise.answerLang]?.dir ?? 'ltr'}
        value={value}
        disabled={locked}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck="false"
        placeholder="Your answer"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) onSubmit();
        }}
      />
    </div>
  );
}
