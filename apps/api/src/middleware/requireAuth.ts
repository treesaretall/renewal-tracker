import type { Request, Response, NextFunction } from 'express';
import { findValidSession, SESSION_COOKIE_NAME } from '../auth/session.js';
import { ApiError } from '../errors.js';

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies[SESSION_COOKIE_NAME] as string | undefined;

  if (!token) {
    throw ApiError.unauthenticated();
  }

  const session = await findValidSession(token);

  if (!session) {
    throw ApiError.unauthenticated();
  }

  req.user = session.user;
  next();
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies[SESSION_COOKIE_NAME] as string | undefined;

  if (token) {
    const session = await findValidSession(token);
    if (session) {
      req.user = session.user;
    }
  }

  next();
}
