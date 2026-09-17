import { useEffect } from 'react';
import { Text } from '../Text';
import { SpeakButton } from '../SpeakButton';

export function MultipleChoice({ exercise, selected, onSelect, locked }) {
  // Number keys pick an option — the fastest way through a drill, and it keeps
  // the whole exercise usable without a mouse.
  useEffect(() => {
    if (locked) return undefined;
    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= exercise.options.length) onSelect(exercise.options[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exercise.options, onSelect, locked]);

  return (
    <div
      role="radiogroup"
      aria-label="Choose the correct translation"
      className="grid gap-3 sm:grid-cols-2"
    >
      {exercise.options.map((option, i) => {
        const isSelected = selected === option;
        // aria-label is explicit because the row also holds the shortcut number
        // and a speaker button; without it a screen reader reads the option as
        // "1 ありがとう No Japanese voice is installed on this device".
        return (
          <div
            key={option}
            role="radio"
            tabIndex={locked ? -1 : 0}
            aria-checked={isSelected}
            aria-disabled={locked}
            aria-label={option}
            onClick={() => !locked && onSelect(option)}
            onKeyDown={(e) => {
              if (locked) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(option);
              }
            }}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-4 text-left
              transition-colors ${locked ? 'cursor-not-allowed' : ''} ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
          >
            <span
              aria-hidden="true"
              className={`hidden h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs
                font-bold sm:flex ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-300 text-slate-400'
                }`}
            >
              {i + 1}
            </span>
            <Text lang={exercise.answerLang} className="flex-1 text-lg">
              {option}
            </Text>
            <SpeakButton text={option} lang={exercise.answerLang} size="sm" />
          </div>
        );
      })}
    </div>
  );
}
