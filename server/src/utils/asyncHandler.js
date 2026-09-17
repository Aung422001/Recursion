/**
 * Express 4 does not catch rejected promises from async handlers; without this
 * wrapper a thrown error in an async route hangs the request instead of
 * reaching the error middleware.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
