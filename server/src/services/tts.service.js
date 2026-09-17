import { LANGUAGE_CODES } from 'shared/constants.js';
import { env } from '../config/env.js';

/**
 * Server-side pronunciation audio.
 *
 * The browser's own speechSynthesis is tried first on the client, but its
 * voices belong to the operating system: a stock Windows install has English
 * and nothing else, which leaves nine of our ten languages silent. This is the
 * fallback that makes the app work anyway.
 *
 * Providers are pluggable because the default one is a compromise:
 *
 * - `google-translate` needs no key and covers every language we teach, but it
 *   is an *undocumented* endpoint, not a supported API. It can rate-limit or
 *   change without notice, and Google's terms do not cover this use. Fine for
 *   development and a portfolio demo; not something to run a real product on.
 * - `none` disables server audio, leaving only whatever voices the OS provides.
 *
 * A paid provider (Google Cloud TTS, Azure, ElevenLabs) drops in as another
 * case in `fetchAudio` without touching anything else.
 */

const MAX_TEXT_LENGTH = 200;
const CACHE_LIMIT = 500; // entries; a word is replayed far more often than it is new
const FETCH_TIMEOUT_MS = 8000;

/** Words repeat constantly, so the same clip is requested over and over. */
const cache = new Map();

const cacheKey = (text, lang) => `${lang}:${text}`;

function readCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  // Refresh recency: Map preserves insertion order, so re-inserting moves it last.
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function writeCache(key, buffer) {
  cache.set(key, buffer);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
}

export const ttsEnabled = () => env.TTS_PROVIDER !== 'none';
export const ttsProvider = () => env.TTS_PROVIDER;
export const ttsCacheSize = () => cache.size;

/** Exposed for tests, which must not leak audio between cases. */
export const clearTtsCache = () => cache.clear();

export class TtsError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * MP3 audio for a word. Returns a Buffer, from cache when possible.
 * @returns {Promise<{audio: Buffer, cached: boolean}>}
 */
export async function synthesize(text, lang) {
  if (!ttsEnabled()) throw new TtsError(503, 'Server-side audio is disabled');

  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new TtsError(400, 'Nothing to speak');
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new TtsError(400, `Text is longer than ${MAX_TEXT_LENGTH} characters`);
  }
  if (!LANGUAGE_CODES.includes(lang)) throw new TtsError(400, `Unsupported language "${lang}"`);

  const key = cacheKey(trimmed, lang);
  const cached = readCache(key);
  if (cached) return { audio: cached, cached: true };

  const audio = await fetchAudio(trimmed, lang);
  writeCache(key, audio);
  return { audio, cached: false };
}

async function fetchAudio(text, lang) {
  switch (env.TTS_PROVIDER) {
    case 'google-translate':
      return fetchFromTranslate(text, lang);
    default:
      throw new TtsError(503, `Unknown TTS provider "${env.TTS_PROVIDER}"`);
  }
}

async function fetchFromTranslate(text, lang) {
  const url =
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob` +
    `&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(text)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // The endpoint returns 403 to an unadorned client.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept-Language': lang,
      },
    });
  } catch (err) {
    throw new TtsError(504, err.name === 'AbortError' ? 'Audio timed out' : 'Audio unreachable');
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    // 429 here means the unofficial endpoint is throttling us, which is exactly
    // the risk that makes it unsuitable for production.
    throw new TtsError(res.status === 429 ? 429 : 502, `Audio provider returned ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!looksLikeMp3(buffer)) throw new TtsError(502, 'Audio provider did not return audio');
  return buffer;
}

/** Guard against a captcha or HTML error page being cached as if it were audio. */
function looksLikeMp3(buffer) {
  if (buffer.length < 128) return false;
  const id3 = buffer.subarray(0, 3).toString('latin1') === 'ID3';
  const frameSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  return id3 || frameSync;
}
