import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env.js';

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  // Tests fire hundreds of requests from one IP; limiting them proves nothing.
  skip: () => isTest,
};

/** 20 attempts per 15 minutes per IP on credential endpoints. */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again later' },
});

/** Generous ceiling for the rest of the API — a lesson is a burst of requests. */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 300,
  message: { error: 'Too many requests' },
});
