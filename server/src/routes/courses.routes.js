import { Router } from 'express';
import {
  listCourses,
  listLanguages,
  switchCourse,
  switchCourseSchema,
} from '../controllers/courses.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/languages', listLanguages); // public: the signup form needs it
router.get('/courses', requireAuth, asyncHandler(listCourses));
router.put(
  '/courses/active',
  requireAuth,
  validate(switchCourseSchema),
  asyncHandler(switchCourse)
);

export default router;
