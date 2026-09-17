import { ApiError } from '../utils/ApiError.js';

/** Replace req[source] with the parsed result so handlers get typed, trimmed data. */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return next(ApiError.badRequest('Validation failed', parsed.error.flatten()));
    }
    req[source] = parsed.data;
    next();
  };
