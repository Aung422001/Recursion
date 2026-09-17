import { LANGUAGES } from 'shared/constants.js';
import { useSpeech } from '../hooks/useSpeech';
import { Card } from './Card';
import { SpeakButton } from './SpeakButton';

const SAMPLE = {
  en: 'hello',
  my: 'မင်္ဂလာပါ',
  th: 'สวัสดี',
  ja: 'こんにちは',
  ko: '안녕하세요',
  vi: 'xin chào',
  id: 'halo',
  ms: 'helo',
  hi: 'नमस्ते',
  ar: 'مرحبا',
};

/** Audio preferences, plus an honest account of which languages can be spoken. */
export function AudioSettings({ activeLang }) {
  const {
    supported,
    autoPlay,
    setAutoPlay,
    rate,
    setRate,
    canSpeak,
    isLocalVoice,
    voiceFor,
    serverTts,
  } = useSpeech();

  if (!supported && !serverTts.enabled) {
    return (
      <Card className="p-5">
        <h2 className="font-semibold">Audio</h2>
        <p className="mt-1 text-sm text-slate-600">
          This browser has no speech support and server audio is off, so pronunciation is
          unavailable.
        </p>
      </Card>
    );
  }

  const onDevice = Object.keys(LANGUAGES).filter((code) => isLocalVoice(code));
  const activeVoice = voiceFor(activeLang);

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Audio</h2>
      <p className="mt-1 text-sm text-slate-500">
        Words use a voice installed on this device where one exists, and stream from the server
        otherwise — so every language has audio even on a machine with no language packs.
      </p>

      <label className="mt-4 flex items-start gap-3">
        <input
          type="checkbox"
          checked={autoPlay}
          onChange={(e) => setAutoPlay(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span>
          <span className="font-medium">Play words automatically</span>
          <span className="block text-sm text-slate-500">
            Speak each word as it appears in a lesson or review.
          </span>
        </span>
      </label>

      <div className="mt-5">
        <label htmlFor="speech-rate" className="label">
          Speaking speed
          <span className="ml-2 font-normal text-slate-500">{rate.toFixed(2)}×</span>
        </label>
        <input
          id="speech-rate"
          type="range"
          min="0.5"
          max="1.5"
          step="0.05"
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="w-full accent-emerald-600"
        />
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-sm font-medium text-slate-700">
          Voices on this device: {onDevice.length} of {Object.keys(LANGUAGES).length} languages
          {serverTts.enabled && (
            <span className="ml-1 font-normal text-slate-500">
              · the rest stream from the server
            </span>
          )}
        </p>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {Object.entries(LANGUAGES).map(([code, meta]) => {
            const available = canSpeak(code);
            return (
              <li key={code} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true">{available ? '🔊' : '🔇'}</span>
                <span className={available ? 'text-slate-700' : 'text-slate-400'}>{meta.name}</span>
                <span className="text-xs text-slate-400">
                  {isLocalVoice(code) ? 'device' : available ? 'server' : 'none'}
                </span>
                {available && <SpeakButton text={SAMPLE[code]} lang={code} size="sm" />}
                {code === activeLang && (
                  <span className="text-xs font-semibold text-emerald-700">· studying</span>
                )}
              </li>
            );
          })}
        </ul>

        {!canSpeak(activeLang) && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">The language you are studying has no audio.</span> Turn
            on server audio with <span className="font-medium">TTS_PROVIDER</span>, or add a{' '}
            {LANGUAGES[activeLang]?.name ?? activeLang} voice under Settings → Time &amp; language on
            Windows and restart the browser.
          </p>
        )}

        {serverTts.enabled && !isLocalVoice(activeLang) && (
          <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <span className="font-semibold">
              {LANGUAGES[activeLang]?.name ?? activeLang} audio comes from the server.
            </span>{' '}
            It needs a connection and starts a shade slower than a local voice. Installing a{' '}
            {LANGUAGES[activeLang]?.name ?? activeLang} voice on this device makes it instant and
            work offline.
          </p>
        )}

        {activeVoice ? (
          <p className="mt-3 text-xs text-slate-400">
            Using “{activeVoice.name}” ({activeVoice.lang}) for{' '}
            {LANGUAGES[activeLang]?.name ?? activeLang}.
          </p>
        ) : (
          serverTts.enabled && (
            <p className="mt-3 text-xs text-slate-400">Server audio provider: {serverTts.provider}.</p>
          )
        )}
      </div>
    </Card>
  );
}
