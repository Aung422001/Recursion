import { api } from './client.js';

export const fetchSummary = () => api.get('/progress/summary');
export const fetchVocabProgress = () => api.get('/progress/vocab');
