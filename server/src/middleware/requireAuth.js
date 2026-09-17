import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization;

  // <audio src> and <img src> cannot set headers, so media endpoints accept the
  // access token as a query parameter too. It is the short-lived token, never
  // the refresh token, and these requests are GETs with no side effects.
  const queryToken = typeof req.query?.access_token === 'string' ? req.query.access_token : null;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;

  if (!token) {
    return next(ApiError.unauthorized('Missing access token'));
  }
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user) return next(ApiError.unauthorized('User not found'));
    req.user = user;
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired access token'));
  }
}
