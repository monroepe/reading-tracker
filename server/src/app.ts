import express from 'express';
import { countriesRouter } from './countries/countries.routes.js';
import type session from 'express-session';
import { sql } from 'drizzle-orm';
import { authRouter } from './auth/auth.routes.js';
import { authorsRouter } from './authors/authors.routes.js';
import { booksRouter } from './books/books.routes.js';
import { isProduction } from './config.js';
import { db } from './db/index.js';
import { genresRouter } from './genres/genres.routes.js';
import { readingsRouter } from './readings/readings.routes.js';
import { tagsRouter } from './tags/tags.routes.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, HttpError, notFound } from './middleware/errors.js';
import { createSessionMiddleware } from './middleware/session.js';
import { analyticsRouter } from './analytics/analytics.routes.js';
import { transfersRouter } from './transfers/transfers.routes.js';

export function createApp(options: { sessionStore?: session.Store } = {}) {
  const app = express();
  if (isProduction) app.set('trust proxy', 1); // behind the host's proxy, needed for secure cookies
  const transferJson = express.json({ limit: '10mb' });
  app.use('/api/transfers/imports', (req, res, next) => {
    transferJson(req, res, error => {
      if (error) return next(new HttpError(error.type === 'entity.too.large' ? 413 : 400,
        error.type === 'entity.too.large' ? 'Transfer exceeds the 10 MiB limit' : 'Invalid transfer JSON'));
      next();
    });
  });
  app.use(express.json());
  app.use(createSessionMiddleware(options.sessionStore));

  // Public
  app.get('/api/health', async (_req, res) => {
    await db.execute(sql`select 1`);
    res.json({ ok: true });
  });
  app.use('/api/auth', authRouter);

  // Everything below requires a logged-in user
  app.use('/api', requireAuth);
  app.use('/api/authors', authorsRouter);
  app.use('/api/books', booksRouter);
  app.use('/api/genres', genresRouter);
  app.use('/api/countries', countriesRouter);
  app.use('/api/readings', readingsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/tags', tagsRouter);
  app.use('/api/transfers', transfersRouter);

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
