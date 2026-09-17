import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, setupDb, teardownDb, clearAll, createAuthedUser } from './helpers.js';
import User from '../src/models/User.js';

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(clearAll);

const validUser = {
  email: 'learner@example.com',
  password: 'correct-horse-battery',
  displayName: 'Aung',
};

describe('POST /api/auth/register', () => {
  it('creates an account and issues both tokens', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser).expect(201);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user).toMatchObject({ email: validUser.email, displayName: 'Aung', xp: 0 });
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookie = res.headers['set-cookie'].join(';');
    expect(cookie).toContain('recursion_refresh');
    expect(cookie).toContain('HttpOnly');
  });

  it('stores a hash, never the password itself', async () => {
    await request(app).post('/api/auth/register').send(validUser).expect(201);
    const user = await User.findOne({ email: validUser.email });
    expect(user.passwordHash).not.toBe(validUser.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/register').send(validUser).expect(201);
    const res = await request(app).post('/api/auth/register').send(validUser).expect(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('normalizes the email to lowercase', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: 'Learner@Example.COM' })
      .expect(201);
    expect(await User.findOne({ email: 'learner@example.com' })).toBeTruthy();
  });

  it.each([
    ['a malformed email', { ...validUser, email: 'not-an-email' }],
    ['a short password', { ...validUser, password: 'short' }],
    ['a blank display name', { ...validUser, displayName: '   ' }],
  ])('rejects %s', async (_label, payload) => {
    const res = await request(app).post('/api/auth/register').send(payload).expect(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validUser);
  });

  it('logs in with the right password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password })
      .expect(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'not-the-password' })
      .expect(401);

    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: validUser.password })
      .expect(401);

    // Differing messages would let an attacker enumerate registered emails.
    expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
  });
});

describe('protected routes', () => {
  it('rejects a request with no token', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });

  it('rejects a malformed or forged token', async () => {
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer nonsense').expect(401);
    await request(app).get('/api/auth/me').set('Authorization', 'Basic abc').expect(401);
  });

  it('accepts a valid token', async () => {
    const learner = await createAuthedUser();
    const res = await learner.get('/api/auth/me').expect(200);
    expect(res.body.user.email).toBe(learner.credentials.email);
    expect(res.body.dueCount).toBe(0);
  });

  it('rejects a token for a deleted user', async () => {
    const learner = await createAuthedUser();
    await User.deleteMany({});
    await learner.get('/api/auth/me').expect(401);
  });
});

describe('refresh and logout', () => {
  it('issues a new access token from the refresh cookie', async () => {
    const learner = await createAuthedUser();
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', learner.cookies)
      .expect(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('refuses to refresh without a cookie', async () => {
    await request(app).post('/api/auth/refresh').expect(401);
  });

  it('clears the cookie on logout', async () => {
    const learner = await createAuthedUser();
    const res = await learner.post('/api/auth/logout').expect(204);
    expect(res.headers['set-cookie'].join(';')).toMatch(/recursion_refresh=;|recursion_refresh=$/);
  });

  it('invalidates every outstanding refresh token on logout-everywhere', async () => {
    const learner = await createAuthedUser();

    // A second device holding its own valid refresh cookie.
    const second = await request(app)
      .post('/api/auth/login')
      .send({ email: learner.credentials.email, password: learner.credentials.password })
      .expect(200);
    const secondCookie = second.headers['set-cookie'];

    await learner.post('/api/auth/logout-everywhere').expect(204);

    await request(app).post('/api/auth/refresh').set('Cookie', learner.cookies).expect(401);
    await request(app).post('/api/auth/refresh').set('Cookie', secondCookie).expect(401);
  });
});

describe('health', () => {
  it('reports status and database connectivity', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'connected' });
  });
});
