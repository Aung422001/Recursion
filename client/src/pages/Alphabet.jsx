import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useSpeech } from '../hooks/useSpeech';
import { fetchAlphabet } from '../api/alphabet';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Text } from '../components/Text';
import { SpeakButton, VoiceUnavailableNote } from '../components/SpeakButton';
import { Spinner, ErrorState, EmptyState } from '../components/States';

/** The writing system of the language being studied, as a reference chart. */
export default function Alphabet() {
  const { data, error, loading, reload } = useApi(fetchAlphabet);
  const [group, setGroup] = useState('all');

  if (loading) return <Spinner label="Loading the alphabet" />;
  if (error) {
    if (error.status === 404) {
      return (
        <EmptyState
          icon="🔤"
          title="No alphabet for this language yet"
          description="The writing system for this course has not been added."
        />
      );
    }
    return <ErrorState error={error} onRetry={reload} />;
  }

  const { lang, scriptName, note, groups, letterCount } = data;
  const shown = group === 'all' ? groups : groups.filter((g) => g.type === group);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{scriptName}</h1>
          <p className="text-sm text-slate-500">
            {lang.name} · {letterCount} characters
          </p>
        </div>
        <Link to="/alphabet/practice">
          <Button>Practice the script</Button>
        </Link>
      </header>

      {note && (
        <Card className="border-l-4 border-l-emerald-400 p-4">
          <p className="text-sm leading-relaxed text-slate-700">{note}</p>
        </Card>
      )}

      <VoiceUnavailableNote lang={lang.code} />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by letter type">
        <FilterChip active={group === 'all'} onClick={() => setGroup('all')}>
          All ({letterCount})
        </FilterChip>
        {groups.map((g) => (
          <FilterChip key={g.type} active={group === g.type} onClick={() => setGroup(g.type)}>
            {g.label} ({g.count})
          </FilterChip>
        ))}
      </div>

      {shown.map((g) => (
        <section key={g.type}>
          <h2 className="mb-3 font-semibold">
            {g.label} <span className="font-normal text-slate-400">· {g.count}</span>
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.letters.map((letter) => (
              <li key={`${letter.type}-${letter.char}-${letter.order}`}>
                <LetterCard letter={letter} lang={lang.code} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-emerald-600 text-white'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function LetterCard({ letter, lang }) {
  const { canSpeak } = useSpeech();
  // Prefer the example word for audio: a lone letter is often read as its
  // alphabet name rather than its sound, and some engines refuse it entirely.
  const spoken = letter.exampleWord ?? letter.char;

  return (
    <Card className="h-full p-3">
      <div className="flex items-start justify-between gap-2">
        <Text lang={lang} className="text-3xl font-bold leading-tight">
          {letter.char}
        </Text>
        <SpeakButton text={spoken} lang={lang} size="sm" />
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-700">{letter.name}</p>
      <p className="text-sm text-emerald-700">{letter.romanization}</p>
      {letter.exampleWord && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
          <Text lang={lang}>{letter.exampleWord}</Text>
          {letter.exampleMeaning && <span className="ml-1">— {letter.exampleMeaning}</span>}
          {!canSpeak(lang) && <span className="sr-only"> (no audio available)</span>}
        </p>
      )}
    </Card>
  );
}
