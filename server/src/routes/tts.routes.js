import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getSpeech, getTtsStatus, ttsQuerySchema } from '../controllers/tts.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isTest } from '../config/env.js';

// Tighter than the general API limit: each miss costs an outbound request to a
// third party, and a lesson only needs a handful of clips.
const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: 'Too many audio requests, please slow down' },
});

const router = Router();

// Public: it only says whether audio is available and for which languages. The
// client asks before anyone has logged in, and an authenticated answer would
// leave the whole app looking mute until the next reload.
router.get('/status', getTtsStatus);

// The audio itself stays behind auth — it proxies to a third party, and an
// unauthenticated version of this is an open proxy.
router.get('/', requireAuth, ttsLimiter, validate(ttsQuerySchema, 'query'), asyncHandler(getSpeech));

export default router;
