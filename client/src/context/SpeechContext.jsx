import { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchTtsStatus, ttsUrl } from '../api/tts';

export const SpeechContext = createContext(null);

const AUTOPLAY_KEY = 'recursion.autoplay';
const RATE_KEY = 'recursion.speechRate';

const readStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback; // private windows and blocked storage both throw
  }
};

const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* a lost preference is not worth breaking the page over */
  }
};

/**
 * Pronunciation through the browser's built-in speech synthesis.
 *
 * No API key and no audio files, but the trade-off is that the voices belong to
 * the operating system: a language with no voice installed simply cannot be
 * spoken, and which languages those are differs per machine. Everything here is
 * built to degrade cleanly to silence rather than to look broken.
 */
export function SpeechProvider({ children }) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [voices, setVoices] = useState([]);
  const [serverTts, setServerTts] = useState({ enabled: false, provider: null });
  const audioRef = useRef(null);
  const [autoPlay, setAutoPlayState] = useState(() => readStored(AUTOPLAY_KEY, true));
  const [rate, setRateState] = useState(() => readStored(RATE_KEY, 0.85));
  const [speakingKey, setSpeakingKey] = useState(null);
  const lastSpoken = useRef(null);

  // Voices load asynchronously, and in some browsers the first call returns an
  // empty list until the engine is ready.
  useEffect(() => {
    if (!supported) return undefined;

    // Hold the engine reference rather than re-reading it on teardown: the
    // cleanup can run after the page is being torn down, and reaching for
    // window.speechSynthesis then can find nothing there.
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices() ?? []);

    load();
    synth.addEventListener?.('voiceschanged', load);
    const retry = setTimeout(load, 1000);

    return () => {
      synth.removeEventListener?.('voiceschanged', load);
      clearTimeout(retry);
      synth.cancel?.();
    };
  }, [supported]);

  // Ask the server whether it can supply audio for languages the device cannot
  // speak. Failing to answer just means no fallback, not an error.
  useEffect(() => {
    let cancelled = false;
    fetchTtsStatus()
      .then((status) => !cancelled && setServerTts(status))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /** The best installed voice for a language code, or null if there is none. */
  const voiceFor = useCallback(
    (lang) => {
      if (!lang || !voices.length) return null;
      const code = lang.toLowerCase();
      const matches = voices.filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith(code));
      if (!matches.length) return null;
      // Prefer the voice the platform marks as default, then a local one:
      // local voices work offline and start without a network round trip.
      return matches.find((v) => v.default) ?? matches.find((v) => v.localService) ?? matches[0];
    },
    [voices]
  );

  /**
   * A word is speakable if the device has a voice for it *or* the server can
   * supply the audio. Most learners will be on the second path: a stock Windows
   * install has English and nothing else.
   */
  const canSpeak = useCallback(
    (lang) => Boolean(voiceFor(lang)) || Boolean(serverTts.enabled && lang),
    [voiceFor, serverTts.enabled]
  );

  const isLocalVoice = useCallback((lang) => Boolean(voiceFor(lang)), [voiceFor]);

  /** Play a word through the server's audio endpoint. */
  const playFromServer = useCallback(
    (text, lang, id) => {
      if (!serverTts.enabled) return false;

      audioRef.current?.pause();
      const audio = new Audio(ttsUrl(text, lang));
      audio.playbackRate = rate;
      audioRef.current = audio;

      setSpeakingKey(id);
      const clear = () => setSpeakingKey((current) => (current === id ? null : current));
      audio.onended = clear;
      audio.onerror = clear;
      audio.play().catch(clear); // autoplay policy can refuse before a gesture

      return true;
    },
    [serverTts.enabled, rate]
  );

  const speak = useCallback(
    (text, lang, { key } = {}) => {
      if (!text) return false;
      const id = key ?? `${lang}:${text}`;
      const voice = supported ? voiceFor(lang) : null;

      // Prefer a local voice: it is instant, works offline, and costs nothing.
      if (!voice) return playFromServer(text, lang, id);

      // Cancel anything still playing, or utterances queue up and overlap.
      audioRef.current?.pause();
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(String(text));
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = rate; // learners need it slower than conversational speed

      utterance.onstart = () => setSpeakingKey(id);
      utterance.onend = () => setSpeakingKey((current) => (current === id ? null : current));
      utterance.onerror = () => setSpeakingKey((current) => (current === id ? null : current));

      window.speechSynthesis.speak(utterance);
      return true;
    },
    [supported, voiceFor, rate, playFromServer]
  );

  /**
   * Speak automatically when a new word appears, if the learner has autoplay on.
   * Guarded against repeats so a re-render does not restart the same word.
   */
  const autoSpeak = useCallback(
    (text, lang) => {
      if (!autoPlay || !text) return false;
      const id = `${lang}:${text}`;
      if (lastSpoken.current === id) return false;
      lastSpoken.current = id;
      return speak(text, lang, { key: id });
    },
    [autoPlay, speak]
  );

  const resetAutoSpeak = useCallback(() => {
    lastSpoken.current = null;
  }, []);

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    audioRef.current?.pause();
    setSpeakingKey(null);
  }, [supported]);

  const setAutoPlay = useCallback(
    (value) => {
      setAutoPlayState(value);
      writeStored(AUTOPLAY_KEY, value);
      if (!value) stop();
    },
    [stop]
  );

  const setRate = useCallback((value) => {
    setRateState(value);
    writeStored(RATE_KEY, value);
  }, []);

  /** Language codes that actually have a voice on this machine. */
  const spokenLanguages = useMemo(
    () => [...new Set(voices.map((v) => v.lang?.toLowerCase().split(/[-_]/)[0]).filter(Boolean))],
    [voices]
  );

  const value = useMemo(
    () => ({
      supported,
      voices,
      spokenLanguages,
      serverTts,
      voiceFor,
      canSpeak,
      isLocalVoice,
      speak,
      autoSpeak,
      resetAutoSpeak,
      stop,
      speakingKey,
      autoPlay,
      setAutoPlay,
      rate,
      setRate,
    }),
    [
      supported,
      voices,
      spokenLanguages,
      serverTts,
      voiceFor,
      canSpeak,
      isLocalVoice,
      speak,
      autoSpeak,
      resetAutoSpeak,
      stop,
      speakingKey,
      autoPlay,
      setAutoPlay,
      rate,
      setRate,
    ]
  );

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}
