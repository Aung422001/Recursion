const BASE = '/api';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// The access token lives in a module-scoped variable, never localStorage — it
// cannot be read by injected script the way storage can, and it is re-issued
// from the httpOnly refresh cookie on every page load.
let accessToken = null;
let onSessionExpired = () => {};

export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const setSessionExpiredHandler = (fn) => {
  onSessionExpired = fn;
};

async function rawRequest(method, path, body, { signal } = {}) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText, data.details);
  return data;
}

// Only one refresh may be in flight: a lesson page can fire several requests at
// once, and without this they would each try to refresh and race each other.
let refreshInFlight = null;

function refreshAccessToken() {
  refreshInFlight ??= rawRequest('POST', '/auth/refresh')
    .then((data) => {
      accessToken = data.accessToken;
      return data;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * Every call retries once through /auth/refresh on a 401, so a 15-minute access
 * token expiring mid-lesson is invisible to the rest of the app.
 */
async function request(method, path, body, opts) {
  try {
    return await rawRequest(method, path, body, opts);
  } catch (err) {
    const isAuthCall = path.startsWith('/auth/refresh') || path.startsWith('/auth/login');
    if (!(err instanceof ApiError) || err.status !== 401 || isAuthCall) throw err;

    try {
      await refreshAccessToken();
    } catch {
      accessToken = null;
      onSessionExpired();
      throw err;
    }
    return rawRequest(method, path, body, opts);
  }
}

export const api = {
  get: (path, opts) => request('GET', path, undefined, opts),
  post: (path, body, opts) => request('POST', path, body ?? {}, opts),
  put: (path, body, opts) => request('PUT', path, body ?? {}, opts),
  refresh: refreshAccessToken,
  raw: rawRequest,
};
