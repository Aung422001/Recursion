import { api } from './client.js';

export const fetchDueReviews = (limit = 10) => api.get(`/review/due?limit=${limit}`);
export const submitReview = (payload) => api.post('/review/attempt', payload);
