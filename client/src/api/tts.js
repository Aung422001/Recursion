import { api, getAccessToken } from './client.js';

export const fetchTtsStatus = () => api.get('/tts/status');

/**
 * URL for a word's audio. The access token rides in the query string because
 * <audio src> cannot carry an Authorization header; the endpoint accepts it
 * either way.
 */
export function ttsUrl(text, lang) {
  const token = getAccessToken();
  const params = new URLSearchParams({ text, lang });
  if (token) params.set('access_token', token);
  return `/api/tts?${params.toString()}`;
}
