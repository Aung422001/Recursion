import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

import { env, isTest } from './config/env.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import courseRoutes from './routes/courses.routes.js';
import alphabetRoutes from './routes/alphabet.routes.js';
import ttsRoutes from './routes/tts.routes.js';
import lessonRoutes from './routes/lessons.routes.js';
import reviewRoutes from './routes/review.routes.js';
import progressRoutes from './routes/progress.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // correct client IPs behind Render/Railway's proxy
  app.use(helmet());
  // credentials:true is required for the httpOnly refresh cookie to survive the
  // cross-origin hop from the Vite dev server to the API.
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!isTest) app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      db: states[mongoose.connection.readyState] ?? 'unknown',
      env: env.NODE_ENV,
    });
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api', courseRoutes);
  app.use('/api/alphabet', alphabetRoutes);
  app.use('/api/tts', ttsRoutes);
  app.use('/api', lessonRoutes);
  app.use('/api/review', reviewRoutes);
  app.use('/api/progress', progressRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
