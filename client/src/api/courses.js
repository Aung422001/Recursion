import { api } from './client.js';

export const fetchLanguages = () => api.get('/languages');
export const fetchCourses = () => api.get('/courses');

export const setActiveCourse = (sourceLang, targetLang) =>
  api.put('/courses/active', { sourceLang, targetLang });
