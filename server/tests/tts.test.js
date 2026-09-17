import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { LANGUAGE_CODES } from 'shared/constants.js';
import { app, setupDb, teardownDb, clearAll, clearUserData, createAuthedUser } from './helpers.js';
import { synthesize, clearTtsCache, ttsCacheSize, TtsError } from '../src/services/tts.service.js';

beforeAll(async () => {
  await setupDb();
  await clearAll();
});
afterAll(teardownDb);
beforeEach(clearUserData);

/** A valid-looking MP3 body, so nothing reaches the real network in tests. */
const fakeMp3 = () => {
  const buf = Buffer.alloc(2048);
  buf[0] = 0xff;
  buf[1] = 0xfb;
  return buf;
};

const stubFetch = (impl) => vi.stubGlobal('fetch', vi.fn(impl));

const okResponse = () => ({
  ok: true,
  status: 200,
  arrayBuffer: async () => fakeMp3(),
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearTtsCache();
});

describe('synthesize', () => {
  it('returns audio for a word', async () => {
    stubFetch(okResponse);
    const { audio, cached } = await synthesize('สวัสดี', 'th');

    expect(Buffer.isBuffer(audio)).toBe(true);
    expect(audio.length).toBeGreaterThan(1000);
    expect(cached).toBe(false);
  });

  it('serves a repeat from cache without calling out again', async () => {
    const fetchMock = vi.fn(okResponse);
    stubFetch(fetchMock);

    await synthesize('สวัสดี', 'th');
    const second = await synthesize('สวัสดี', 'th');

    expect(second.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1); // the second never left the process
  });

  it('caches per language, not per word', async () => {
    const fetchMock = vi.fn(okResponse);
    stubFetch(fetchMock);

    await synthesize('hello', 'en');
    await synthesize('hello', 'th'); // same text, different language

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ttsCacheSize()).toBe(2);
  });

  it('asks the provider for the right language', async () => {
    const fetchMock = vi.fn(okResponse);
    stubFetch(fetchMock);

    await synthesize('こんにちは', 'ja');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('tl=ja');
    expect(url).toContain(encodeURIComponent('こんにちは'));
  });

  it.each([
    ['empty text', '', 'th'],
    ['whitespace only', '   ', 'th'],
    ['an unknown language', 'hello', 'klingon'],
  ])('rejects %s', async (_label, text, lang) => {
    stubFetch(okResponse);
    await expect(synthesize(text, lang)).rejects.toBeInstanceOf(TtsError);
  });

  it('rejects text long enough to be an abuse vector', async () => {
    stubFetch(okResponse);
    await expect(synthesize('x'.repeat(500), 'en')).rejects.toMatchObject({ status: 400 });
  });

  it('refuses to cache a response that is not audio', async () => {
    // A captcha or error page would otherwise be stored and replayed forever.
    stubFetch(() => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => Buffer.from('<html>go away</html>'),
    }));

    await expect(synthesize('สวัสดี', 'th')).rejects.toMatchObject({ status: 502 });
    expect(ttsCacheSize()).toBe(0);
  });

  it('surfaces throttling from the provider as a 429', async () => {
    stubFetch(() => ({ ok: false, status: 429, arrayBuffer: async () => Buffer.alloc(0) }));
    await expect(synthesize('สวัสดี', 'th')).rejects.toMatchObject({ status: 429 });
  });

  it('turns a provider outage into a gateway error, not a crash', async () => {
    stubFetch(() => {
      throw new Error('network down');
    });
    await expect(synthesize('สวัสดี', 'th')).rejects.toMatchObject({ status: 504 });
  });
});

describe('GET /api/tts/status', () => {
  it('is public, so the app knows about audio before anyone logs in', async () => {
    const res = await request(app).get('/api/tts/status').expect(200);

    expect(res.body.enabled).toBe(true);
    expect(res.body.provider).toBeTruthy();
    expect(res.body.languages).toEqual(LANGUAGE_CODES);
  });
});

describe('GET /api/tts', () => {
  it('streams MP3 audio for an authenticated learner', async () => {
    stubFetch(okResponse);
    const learner = await createAuthedUser();

    const res = await learner.get('/api/tts?lang=th&text=' + encodeURIComponent('สวัสดี')).expect(200);

    expect(res.headers['content-type']).toBe('audio/mpeg');
    expect(res.headers['cache-control']).toMatch(/max-age/);
    expect(res.body.length).toBeGreaterThan(1000);
  });

  it('reports whether the clip came from the cache', async () => {
    stubFetch(okResponse);
    const learner = await createAuthedUser();
    const url = '/api/tts?lang=ja&text=' + encodeURIComponent('こんにちは');

    const first = await learner.get(url).expect(200);
    const second = await learner.get(url).expect(200);

    expect(first.headers['x-tts-cache']).toBe('miss');
    expect(second.headers['x-tts-cache']).toBe('hit');
  });

  it('is not an open proxy', async () => {
    stubFetch(okResponse);
    await request(app).get('/api/tts?lang=th&text=hello').expect(401);
  });

  it('accepts the token as a query parameter, because audio elements cannot set headers', async () => {
    stubFetch(okResponse);
    const learner = await createAuthedUser();

    await request(app)
      .get(`/api/tts?lang=en&text=hello&access_token=${learner.accessToken}`)
      .expect(200);
  });

  it('rejects a forged query token', async () => {
    stubFetch(okResponse);
    await request(app).get('/api/tts?lang=en&text=hello&access_token=nonsense').expect(401);
  });

  it.each([
    ['an unknown language', '/api/tts?lang=klingon&text=hi'],
    ['missing text', '/api/tts?lang=th'],
    ['missing language', '/api/tts?text=hi'],
  ])('rejects %s', async (_label, path) => {
    stubFetch(okResponse);
    const learner = await createAuthedUser();
    await learner.get(path).expect(400);
  });

  it('passes a provider failure through as an error, not as silence', async () => {
    stubFetch(() => ({ ok: false, status: 500, arrayBuffer: async () => Buffer.alloc(0) }));
    const learner = await createAuthedUser();

    const res = await learner.get('/api/tts?lang=th&text=' + encodeURIComponent('สวัสดี'));
    expect(res.status).toBe(502);
    expect(res.body.error).toBeTruthy();
  });

  it('can speak every language the app teaches', async () => {
    stubFetch(okResponse);
    const learner = await createAuthedUser();

    for (const lang of LANGUAGE_CODES) {
      await learner.get(`/api/tts?lang=${lang}&text=hello`).expect(200);
    }
  });
});
