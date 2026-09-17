import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  logoutEverywhere,
  me,
  credentialsSchema,
  registerSchema,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(register));
router.post('/login', authLimiter, validate(credentialsSchema), asyncHandler(login));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));
router.post('/logout-everywhere', requireAuth, asyncHandler(logoutEverywhere));
router.get('/me', requireAuth, asyncHandler(me));

export default router;
