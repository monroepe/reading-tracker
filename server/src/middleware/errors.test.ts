import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { HttpError, errorHandler } from './errors.js';

function appThatThrows(err: unknown) {
  const app = express();
  app.get('/boom', () => {
    throw err;
  });
  app.use(errorHandler);
  return app;
}

const pgError = (code: string, detail?: string) => Object.assign(new Error('pg'), { code, detail });

describe('errorHandler', () => {
  it('uses the status and message of an HttpError', async () => {
    const res = await request(appThatThrows(new HttpError(404, 'Book not found'))).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Book not found' });
  });

  it('returns 400 with the issues for a validation error', async () => {
    const zodError = z.string().safeParse(42).error;
    const res = await request(appThatThrows(zodError)).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body.error).toHaveLength(1);
  });

  it.each([
    ['unique violation', pgError('23505'), 409, 'Already exists'],
    ['missing referenced row', pgError('23503', 'Key (author_id)=(9) is not present in table "authors".'), 400, 'A referenced record does not exist'],
    ['row still referenced', pgError('23503', 'Key (id)=(1) is still referenced from table "books".'), 409, 'Referenced by other records'],
    ['check violation', pgError('23514'), 400, 'Value violates a database rule'],
    ['wrapped driver error', new Error('wrapped', { cause: { code: '23505' } }), 409, 'Already exists'],
  ])('maps a %s', async (_name, err, status, message) => {
    const res = await request(appThatThrows(err)).get('/boom');
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error: message });
  });

  it('returns a generic 500 for anything else and logs it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(appThatThrows(new Error('secret details'))).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(log).toHaveBeenCalled();
  });
});
