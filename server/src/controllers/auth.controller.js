import { z } from 'zod';
import User from '../models/User.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { isProduction } from '../config/env.js';
import { LANGUAGE_CODES } from 'shared/constants.js';
import { effectiveStreak } from '../services/streak.service.js';
import { countDue } from '../services/progress.service.js';

const REFRESH_COOKIE = 'recursion_refresh';
const cookieOpts = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'), // bcrypt truncates past 72 bytes
});

export const registerSchema = credentialsSchema
  .extend({
    displayName: z.string().trim().min(1).max(40),
    sourceLang: z.enum(LANGUAGE_CODES).optional(),
    targetLang: z.enum(LANGUAGE_CODES).optional(),
    timezoneOffsetMinutes: z.number().int().min(-840).max(840).optional(),
  })
  .refine((v) => !v.sourceLang || !v.targetLang || v.sourceLang !== v.targetLang, {
    message: 'A course must be between two different languages',
  });

function issueSession(res, user) {
  res.cookie(REFRESH_COOKIE, signRefreshToken(user), cookieOpts);
  return signAccessToken(user);
}

export async function register(req, res) {
  const { email, password, displayName, sourceLang, targetLang, timezoneOffsetMinutes } = req.body;

  if (await User.findOne({ email })) throw ApiError.conflict('Email already registered');

  const user = await User.create({
    email,
    passwordHash: await hashPassword(password),
    displayName,
    ...(sourceLang ? { sourceLang } : {}),
    ...(targetLang ? { targetLang } : {}),
    ...(timezoneOffsetMinutes !== undefined ? { timezoneOffsetMinutes } : {}),
  });

  res.status(201).json({ accessToken: issueSession(res, user), user: user.toPublicJSON() });
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  // Same message either way — never reveal which half of the pair was wrong.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  res.json({ accessToken: issueSession(res, user), user: user.toPublicJSON() });
}

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(payload.sub);
  if (!user || user.refreshTokenVersion !== payload.v) {
    throw ApiError.unauthorized('Refresh token revoked');
  }

  res.json({ accessToken: signAccessToken(user), user: user.toPublicJSON() });
}

export async function logout(_req, res) {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
  res.status(204).end();
}

/** Bump refreshTokenVersion to invalidate every outstanding refresh token. */
export async function logoutEverywhere(req, res) {
  req.user.refreshTokenVersion += 1;
  await req.user.save();
  res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
  res.status(204).end();
}

export async function me(req, res) {
  const user = req.user;
  const offsetMinutes = user.timezoneOffsetMinutes ?? 0;
  res.json({
    user: {
      ...user.toPublicJSON(),
      // The stored streak is only true until the learner misses a day.
      currentStreak: effectiveStreak(user, { offsetMinutes }),
    },
    dueCount: await countDue(user._id, user.targetLang),
  });
}
