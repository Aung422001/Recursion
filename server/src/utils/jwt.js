import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signAccessToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

export const signRefreshToken = (user) =>
  jwt.sign({ sub: user._id.toString(), v: user.refreshTokenVersion }, env.JWT_REFRESH_SECRET, {
    expiresIn: '30d',
  });

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);
