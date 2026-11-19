import type { Request, RequestHandler } from 'express';
import { getUser } from '../auth/auth.service.js';
import { HttpError } from './errors.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) throw new HttpError(401, 'Not authenticated');
  next();
};

export function currentUserId(req: Request): number {
  const id = req.session.userId;
  if (!id) throw new HttpError(401, 'Not authenticated');
  return id;
}

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  const user = await getUser(currentUserId(req));
  if (user.role !== 'admin') throw new HttpError(403, 'Admin access required');
  next();
};
