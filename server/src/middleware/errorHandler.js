import { ApiError } from '../utils/ApiError.js';
import { isProduction, isTest } from '../config/env.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

// The unused fourth parameter is load-bearing: Express identifies error
// middleware by arity, and dropping it turns this into a normal handler.
export function errorHandler(err, req, res, _next) {
  let status = err.status ?? 500;
  let message = err.message ?? 'Internal server error';
  let details = err.details;

  // Translate the Mongo/Mongoose errors that reach the client most often.
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
  } else if (err.code === 11000) {
    status = 409;
    message = `Duplicate value for ${Object.keys(err.keyPattern ?? {}).join(', ')}`;
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  if (status >= 500 && !isTest) console.error(err);

  res.status(status).json({
    error: message,
    ...(details ? { details } : {}),
    ...(isProduction || status < 500 ? {} : { stack: err.stack }),
  });
}
