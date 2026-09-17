import { useMemo, useState, useEffect } from 'react';
import { Text } from '../Text';

/**
 * Tap a word on the left, then its translation on the right. Matched rows stay
 * visible but dimmed, so the learner can see what they have already used up.
 */
export function MatchPairs({ exercise, matches, onChange, locked }) {
  const [activeLeft, setActiveLeft] = useState(null);

  // Shuffled once per exercise — reshuffling on every render would move the
  // buttons under the learner's finger mid-tap.
  const rights = useMemo(
    () => shuffle(exercise.pairs.map((p) => p.right)),
     
    [exercise]
  );

  useEffect(() => setActiveLeft(null), [exercise]);

  const matchedLefts = new Set(matches.map((m) => m.left));
  const matchedRights = new Set(matches.map((m) => m.right));

  const pickLeft = (left) => {
    if (locked) return;
    if (matchedLefts.has(left)) {
      onChange(matches.filter((m) => m.left !== left)); // tap a matched row to undo it
      return;
    }
    setActiveLeft((current) => (current === left ? null : left));
  };

  const pickRight = (right) => {
    if (locked) return;
    if (matchedRights.has(right)) {
      onChange(matches.filter((m) => m.right !== right));
      return;
    }
    if (!activeLeft) return;
    onChange([...matches, { left: activeLeft, right }]);
    setActiveLeft(null);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <ul className="space-y-2">
        {exercise.pairs.map((pair) => (
          <li key={pair.left}>
            <Chip
              onClick={() => pickLeft(pair.left)}
              active={activeLeft === pair.left}
              matched={matchedLefts.has(pair.left)}
              locked={locked}
              lang={exercise.promptLang}
            >
              {pair.left}
            </Chip>
          </li>
        ))}
      </ul>
      <ul className="space-y-2">
        {rights.map((right) => (
          <li key={right}>
            <Chip
              onClick={() => pickRight(right)}
              matched={matchedRights.has(right)}
              locked={locked}
              lang={exercise.answerLang}
            >
              {right}
            </Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ onClick, active, matched, locked, lang, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      aria-pressed={active || matched}
      className={`w-full rounded-xl border-2 px-3 py-3 text-left transition-colors
        disabled:cursor-not-allowed ${
          matched
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 opacity-60'
            : active
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
        }`}
    >
      <Text lang={lang}>{children}</Text>
    </button>
  );
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
