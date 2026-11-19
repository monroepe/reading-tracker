import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { pgError } from '../db/errors.js';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues });
    return;
  }
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    res.status(err.type === 'entity.too.large' ? 413 : 400).json({
      error: err.type === 'entity.too.large' ? 'Request body is too large' : 'Invalid JSON',
    });
    return;
  }
  const pg = pgError(err);
  if (pg?.code === '23505') {
    res.status(409).json({ error: 'Already exists' });
    return;
  }
  if (pg?.code === '23503') {
    if (pg.detail?.includes('is not present in table')) {
      res.status(400).json({ error: 'A referenced record does not exist' });
    } else {
      res.status(409).json({ error: 'Referenced by other records' });
    }
    return;
  }
  if (pg?.code === '23514') {
    res.status(400).json({ error: 'Value violates a database rule' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
