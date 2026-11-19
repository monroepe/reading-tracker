import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { config, isProduction } from '../config.js';
import { pool } from '../db/index.js';

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

export const SESSION_COOKIE = 'rt.sid';

export function createSessionMiddleware(store?: session.Store) {
  const PgStore = connectPgSimple(session);
  return session({
    name: SESSION_COOKIE,
    secret: config.SESSION_SECRET,
    store: store ?? new PgStore({ pool, tableName: 'session' }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  });
}
