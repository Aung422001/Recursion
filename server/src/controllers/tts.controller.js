import { z } from 'zod';
import { LANGUAGE_CODES } from 'shared/constants.js';
import { synthesize, ttsEnabled, ttsProvider, TtsError } from '../services/tts.service.js';
import { ApiError } from '../utils/ApiError.js';

export const ttsQuerySchema = z.object({
  text: z.string().min(1).max(200),
  lang: z.enum(LANGUAGE_CODES),
  access_token: z.string().optional(), // media elements authenticate this way
});

/** Whether the client should bother falling back to server audio. */
export function getTtsStatus(_req, res) {
  res.json({ enabled: ttsEnabled(), provider: ttsProvider(), languages: LANGUAGE_CODES });
}

/**
 * Stream one word as MP3. Behind auth deliberately: an open text-to-speech
 * endpoint is an open proxy, and this one forwards to a third party.
 */
export async function getSpeech(req, res) {
  const { text, lang } = req.query;

  let result;
  try {
    result = await synthesize(text, lang);
  } catch (err) {
    if (err instanceof TtsError) throw new ApiError(err.status, err.message);
    throw err;
  }

  res.set({
    'Content-Type': 'audio/mpeg',
    'Content-Length': result.audio.length,
    // The pronunciation of a word does not change, so let the browser keep it.
    'Cache-Control': 'public, max-age=86400',
    'X-Tts-Cache': result.cached ? 'hit' : 'miss',
  });
  res.send(result.audio);
}
