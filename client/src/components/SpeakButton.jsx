import { LANGUAGES } from 'shared/constants.js';
import { useSpeech } from '../hooks/useSpeech';

const SIZES = {
  sm: 'h-7 w-7 text-sm',
  md: 'h-9 w-9 text-base',
  lg: 'h-11 w-11 text-lg',
};

/**
 * Plays a word aloud. When the language has no voice installed the button stays
 * visible but disabled and says so — hiding it would leave the learner
 * wondering why some words have audio and others do not.
 */
export function SpeakButton({ text, lang, size = 'md', className = '' }) {
  const { speak, canSpeak, isLocalVoice, serverTts, speakingKey } = useSpeech();

  if (!text) return null;

  const available = canSpeak(lang);
  const languageName = LANGUAGES[lang]?.name ?? lang;
  const isSpeaking = speakingKey === `${lang}:${text}`;

  const label = available
    ? `Hear this in ${languageName}${isLocalVoice(lang) ? '' : ' (from the server)'}`
    : serverTts.enabled
      ? `No ${languageName} audio available`
      : `No ${languageName} voice on this device, and server audio is off`;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={!available}
      data-speak-lang={lang}
      data-speak-available={available ? 'yes' : 'no'}
      data-speak-source={isLocalVoice(lang) ? 'device' : available ? 'server' : 'none'}
      onClick={(e) => {
        e.stopPropagation(); // these sit inside clickable rows
        e.preventDefault();
        speak(text, lang, { key: `${lang}:${text}` });
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors
        ${SIZES[size]} ${
          available
            ? 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
            : 'cursor-not-allowed text-slate-300'
        } ${isSpeaking ? 'animate-pulse bg-emerald-50 text-emerald-700' : ''} ${className}`}
    >
      <span aria-hidden="true">{available ? '🔊' : '🔇'}</span>
    </button>
  );
}

/**
 * Explains, once, why a language is silent — and how to fix it. Speech voices
 * come from the operating system, which is not obvious to anyone.
 */
export function VoiceUnavailableNote({ lang, className = '' }) {
  const { canSpeak } = useSpeech();
  if (canSpeak(lang)) return null; // the server covers what the device cannot

  const name = LANGUAGES[lang]?.name ?? lang;

  return (
    <p
      className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className}`}
    >
      <span className="font-semibold">No {name} audio available.</span> This device has no {name}{' '}
      voice and server-side audio is switched off. Set{' '}
      <span className="font-medium">TTS_PROVIDER</span> in the server environment, or add a {name}{' '}
      voice under Settings → Time &amp; language on Windows.
    </p>
  );
}
