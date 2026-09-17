import { api } from './client.js';

export const fetchUnits = () => api.get('/units');
export const fetchLesson = (slug) => api.get(`/lessons/${encodeURIComponent(slug)}`);

export const submitAttempt = (slug, payload) =>
  api.post(`/lessons/${encodeURIComponent(slug)}/attempt`, payload);

export const completeLesson = (slug, payload) =>
  api.post(`/lessons/${encodeURIComponent(slug)}/complete`, payload);
