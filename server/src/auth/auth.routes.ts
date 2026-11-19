import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { currentUserId, requireAuth } from '../middleware/auth.js';
import { SESSION_COOKIE } from '../middleware/session.js';
import { loginInput } from './auth.schemas.js';
import * as service from './auth.service.js';

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, legacyHeaders: false });

export const authRouter = Router();

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginInput.parse(req.body);
  const user = await service.login(email, password);
  // New session id on login prevents session fixation.
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
  );
  req.session.userId = user.id;
  res.json(user);
});

authRouter.post('/logout', async (req, res) => {
  await new Promise<void>((resolve, reject) =>
    req.session.destroy((err) => (err ? reject(err) : resolve())),
  );
  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await service.getUser(currentUserId(req)));
});
