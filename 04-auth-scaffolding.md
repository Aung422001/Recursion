# Recursion — Auth Scaffolding (JWT, email/password)

**Strategy:** short-lived access token (in memory on the client, ~15 min) + long-lived refresh token (httpOnly cookie, ~30 days). `refreshTokenVersion` on `User` lets you invalidate all outstanding refresh tokens for an account (e.g. on password change or "log out everywhere") without maintaining a token blocklist.

## `server/src/utils/password.js`

```js
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);
```

## `server/src/utils/jwt.js`

```js
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signAccessToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

export const signRefreshToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), v: user.refreshTokenVersion },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);
```

## `server/src/middleware/requireAuth.js`

```js
import { verifyAccessToken } from '../utils/jwt.js';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing access token' });
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}
```

## `server/src/controllers/auth.controller.js`

```js
import { z } from 'zod';
import User from '../models/User.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

const REFRESH_COOKIE = 'recursion_refresh';
const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function register(req, res) {
  const parsed = credentialsSchema.extend({ displayName: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password, displayName } = parsed.data;
  if (await User.findOne({ email })) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const user = await User.create({ email, passwordHash: await hashPassword(password), displayName });
  const accessToken = signAccessToken(user);
  res.cookie(REFRESH_COOKIE, signRefreshToken(user), cookieOpts);
  res.status(201).json({ accessToken, user: { id: user._id, email, displayName } });
}

export async function login(req, res) {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const accessToken = signAccessToken(user);
  res.cookie(REFRESH_COOKIE, signRefreshToken(user), cookieOpts);
  res.json({ accessToken, user: { id: user._id, email: user.email, displayName: user.displayName } });
}

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  try {
    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.sub);
    if (!user || user.refreshTokenVersion !== payload.v) {
      return res.status(401).json({ error: 'Refresh token revoked' });
    }
    res.json({ accessToken: signAccessToken(user) });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

export async function logout(req, res) {
  res.clearCookie(REFRESH_COOKIE, cookieOpts);
  res.status(204).end();
}

// bump refreshTokenVersion to invalidate every outstanding refresh token (all devices)
export async function logoutEverywhere(req, res) {
  req.user.refreshTokenVersion += 1;
  await req.user.save();
  res.clearCookie(REFRESH_COOKIE, cookieOpts);
  res.status(204).end();
}
```

## `server/src/routes/auth.routes.js`

```js
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, refresh, logout, logoutEverywhere } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }); // 20 attempts / 15 min / IP

const router = Router();
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/logout-everywhere', requireAuth, logoutEverywhere);

export default router;
```

Wire it in `server/src/app.js` with `app.use('/api/auth', authRoutes)`, plus `cookie-parser`, `cors({ origin: env.CLIENT_ORIGIN, credentials: true })`, and `helmet()`.

## Client — `AuthContext`

```jsx
// client/src/context/AuthContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setAccessToken(null);
    setUser(null);
  }, []);

  // on mount, try to silently refresh using the httpOnly cookie
  useEffect(() => {
    api.post('/auth/refresh')
      .then((data) => setAccessToken(data.accessToken))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

The access token lives only in React state — never `localStorage` — so it disappears on refresh/close and gets re-issued from the refresh cookie. `api.post` (a thin `fetch` wrapper, not shown) should attach `Authorization: Bearer <accessToken>` when present and call `/auth/refresh` once on a 401 before giving up, so an expired access token is invisible to the rest of the app.

## Env vars needed (`server/.env.example`)

```
PORT=4000
MONGO_URI=mongodb://localhost:27017/recursion
JWT_ACCESS_SECRET=replace-with-32+-char-random-string
JWT_REFRESH_SECRET=replace-with-a-different-32+-char-random-string
CLIENT_ORIGIN=http://localhost:5173
```

Generate secrets with `openssl rand -hex 32`. Never commit `.env` — only `.env.example`.

---

**Open question for you:** the client keeps the refresh token in an httpOnly cookie, which means client and server need to be on the same site or a CORS setup with `credentials: true` (fine for one deployment, slightly more setup if client/server end up on different subdomains). Comfortable with that, or would you rather keep both tokens client-managed (simpler CORS, slightly weaker XSS posture)?
