import { api } from './client.js';

export const fetchAlphabet = (lang) => api.get(lang ? `/alphabet?lang=${lang}` : '/alphabet');

export const fetchAlphabetDrill = (limit = 10, type = 'all') =>
  api.get(`/alphabet/drill?limit=${limit}&type=${type}`);

export const submitAlphabetAttempt = (payload) => api.post('/alphabet/attempt', payload);
