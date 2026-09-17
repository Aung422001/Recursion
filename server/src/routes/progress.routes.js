import { Router } from 'express';
import { getSummary, getVocabProgress } from '../controllers/progress.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);
router.get('/summary', asyncHandler(getSummary));
router.get('/vocab', asyncHandler(getVocabProgress));

export default router;
