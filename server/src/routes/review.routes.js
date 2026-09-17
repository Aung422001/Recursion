import { Router } from 'express';
import {
  getDueReviews,
  submitReviewAttempt,
  dueQuerySchema,
  reviewAttemptSchema,
} from '../controllers/review.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);
router.get('/due', validate(dueQuerySchema, 'query'), asyncHandler(getDueReviews));
router.post('/attempt', validate(reviewAttemptSchema), asyncHandler(submitReviewAttempt));

export default router;
