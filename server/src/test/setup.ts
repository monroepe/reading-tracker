import type { NextFunction, Request, Response } from 'express';
import { vi } from 'vitest';

// Route tests don't exercise sessions. Auth tests can vi.unmock these.
vi.mock('../middleware/session.js', () => ({
  SESSION_COOKIE: 'rt.sid',
  createSessionMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
  currentUserId: () => 1,
  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
