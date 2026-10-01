import type { ErrorRequestHandler, RequestHandler } from 'express';
import { NotFoundError, ValidationError } from '../../domain/error/DomainErrors.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
};

/** Global error handling: every error leaves the API with the same shape. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    return;
  }
  if (error instanceof ValidationError) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
};
