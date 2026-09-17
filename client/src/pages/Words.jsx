import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { fetchVocabProgress } from '../api/progress';
import { Card } from '../components/Card';
import { Spinner, ErrorState, EmptyState } from '../components/States';
import { Text } from '../components/Text';
import { SpeakButton } from '../components/SpeakButton';

const FILTERS = {
  all: () => true,
  due: (w) => new Date(w.dueDate) <= new Date(),
  learned: (w) => w.repetitions >= 2,
  shaky: (w) => w.accuracy !== null && w.accuracy < 0.7,
};

export default function Words() {
  const { data, error, loading, reload } = useApi(fetchVocabProgress);
  const [filter, setFilter] = useState('all');

  if (loading) return <Spinner label="Loading your words" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const items = data.items;
  const { source: sourceLang, target: targetLang } = data.course;
  if (!items.length) {
    return (
      <EmptyState
        icon="📖"
        title="No words yet"
        description="Finish your first lesson in this course and every word you meet will be tracked here with its review schedule."
      />
    );
  }

  const shown = items.filter(FILTERS[filter]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">My words</h1>
        <p className="text-sm text-slate-500">{items.length} words in your collection</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter words">
        {Object.keys(FILTERS).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors ${
              filter === key
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {key} ({items.filter(FILTERS[key]).length})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="🔍" title="No words match this filter" />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {shown.map((word) => (
              <li key={word.conceptId} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <Text lang={sourceLang} as="p" className="font-medium">
                    {word.source}
                  </Text>
                  <p className="flex items-center gap-1 text-sm text-slate-600">
                    <Text lang={targetLang}>{word.target}</Text>
                    <SpeakButton text={word.target} lang={targetLang} size="sm" />
                    {word.romanization && (
                      <span className="ml-2 text-xs italic text-slate-400">
                        {word.romanization}
                      </span>
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {word.accuracy === null ? '—' : `${Math.round(word.accuracy * 100)}%`}
                  </p>
                  <p className="text-xs text-slate-500">{describeDue(word.dueDate)}</p>
                </div>
                <StrengthDots repetitions={word.repetitions} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function describeDue(dueDate) {
  const days = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  if (days <= 0) return 'due now';
  if (days === 1) return 'due tomorrow';
  return `due in ${days}d`;
}

/** Four dots for how far up the SM-2 ladder a word has climbed. */
function StrengthDots({ repetitions }) {
  const filled = Math.min(4, repetitions);
  return (
    <span
      className="hidden shrink-0 gap-1 sm:flex"
      title={`${repetitions} successful review(s) in a row`}
      aria-label={`Strength ${filled} of 4`}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i < filled ? 'bg-emerald-500' : 'bg-slate-200'}`}
        />
      ))}
    </span>
  );
}
