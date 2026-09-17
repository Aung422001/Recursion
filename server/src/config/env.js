import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string().min(1),
  MONGO_URI_TEST: z.string().default('mongodb://127.0.0.1:27017/recursion_test'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  // Where pronunciation audio comes from when the browser has no voice for a
  // language. See services/tts.service.js for what each provider costs you.
  TTS_PROVIDER: z.enum(['google-translate', 'none']).default('google-translate'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast and loudly — a missing secret should never surface as a cryptic
  // runtime error three requests into a session.
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${issues}\n\nCopy server/.env.example to server/.env and fill it in.`);
  process.exit(1);
}

export const env = parsed.data;

export const isTest = env.NODE_ENV === 'test';
export const isProduction = env.NODE_ENV === 'production';

/** The test suite talks to a throwaway database so it can wipe collections freely. */
export const mongoUri = isTest ? env.MONGO_URI_TEST : env.MONGO_URI;
