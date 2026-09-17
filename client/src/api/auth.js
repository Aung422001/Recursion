import { api } from './client.js';

export const registerRequest = (payload) =>
  api.raw('POST', '/auth/register', {
    ...payload,
    // Sent so the server can roll streaks over the learner's local midnight.
    timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
  });

export const loginRequest = (email, password) => api.raw('POST', '/auth/login', { email, password });
export const logoutRequest = () => api.raw('POST', '/auth/logout');
export const meRequest = () => api.get('/auth/me');
