import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { seed, syncIndexes } from '../src/seed/seed.js';
import { seedAlphabets } from '../src/seed/seedAlphabets.js';

export const app = createApp();

export async function setupDb() {
  await connectDb();
  // Keep indexes in step with the schemas — a stale unique index from an older
  // shape silently breaks writes rather than failing loudly.
  await syncIndexes(() => {});
}

export async function teardownDb() {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
}

/** Wipe runtime data between tests, leaving seeded content in place. */
export async function clearUserData() {
  await Promise.all(
    ['users', 'userprogresses', 'lessoncompletions'].map((name) =>
      mongoose.connection.db.collection(name).deleteMany({})
    )
  );
}

export async function clearAll() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export const seedContent = () => seed({ log: () => {} });
export const seedScripts = () => seedAlphabets({ log: () => {} });

let counter = 0;

/**
 * Register a user and return an authenticated request helper, so tests read as
 * "what the user does" rather than as token plumbing.
 */
export async function createAuthedUser(overrides = {}) {
  const credentials = {
    email: `user${Date.now()}-${counter++}@example.com`,
    password: 'correct-horse-battery',
    displayName: 'Test Learner',
    sourceLang: 'en',
    targetLang: 'my',
    ...overrides,
  };

  const res = await request(app).post('/api/auth/register').send(credentials).expect(201);
  const { accessToken, user } = res.body;
  const cookies = res.headers['set-cookie'];

  const authed = (method, path) =>
    request(app)[method](path).set('Authorization', `Bearer ${accessToken}`).set('Cookie', cookies);

  return {
    credentials,
    user,
    accessToken,
    cookies,
    get: (path) => authed('get', path),
    post: (path) => authed('post', path),
    put: (path) => authed('put', path),
  };
}
