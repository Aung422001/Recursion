import { Router } from 'express';
import {
  getAlphabet,
  getAlphabetDrill,
  submitDrillAttempt,
  alphabetQuerySchema,
  drillQuerySchema,
  drillAttemptSchema,
} from '../controllers/alphabet.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);
router.get('/', validate(alphabetQuerySchema, 'query'), asyncHandler(getAlphabet));
router.get('/drill', validate(drillQuerySchema, 'query'), asyncHandler(getAlphabetDrill));
router.post('/attempt', validate(drillAttemptSchema), asyncHandler(submitDrillAttempt));

export default router;
