/**
 * File: errors.js
 * Author: Swathi Pallikala
 * Project: PhishLens
 * Description:
 *   Centralized Express error utilities:
 *   - notFound: 404 handler for unmatched routes
 *   - errorHandler: final error middleware to format errors consistently
 *   Notes:
 *   - In development, we include the error stack for easier debugging.
 *   - In production, we hide the stack to avoid leaking internals.
 */

/** 404 handler for unknown routes */
export function notFound(_req, res) {
  res.status(404).json({ error: 'Not Found' });
}

/** Final error handler */
export function errorHandler(err, _req, res, _next) { // _next kept for Express signature
  console.error(err);
  const status = err.status || 500;
  const payload = {
    error: err.message || 'Server Error',
  };
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }
  res.status(status).json(payload);
}
