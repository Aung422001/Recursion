import { Router } from 'express';
import {
  listUnits,
  getLesson,
  submitAttempt,
  completeLesson,
  attemptSchema,
  completeSchema,
} from '../controllers/lessons.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);
router.get('/units', asyncHandler(listUnits));
router.get('/lessons/:idOrSlug', asyncHandler(getLesson));
router.post('/lessons/:idOrSlug/attempt', validate(attemptSchema), asyncHandler(submitAttempt));
router.post('/lessons/:idOrSlug/complete', validate(completeSchema), asyncHandler(completeLesson));

export default router;
