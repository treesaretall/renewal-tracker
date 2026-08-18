import { randomBytes, createHash } from 'node:crypto';
import { db } from '../db.js';

const SESSION_TTL_DAYS = 30;

export const SESSION_COOKIE_NAME = 'rt_session';

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    // sameSite lax + JSON-only API provides CSRF protection. If we ever accept form posts, add a token-based CSRF scheme.
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  // Store SHA-256 hash of token, never the token itself. If the DB is leaked, stolen hashes can't be replayed.
  const id = hashToken(token);

  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await db.session.create({
    data: {
      id,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function findValidSession(token: string) {
  const id = hashToken(token);
  const session = await db.session.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  const now = new Date();
  if (session.expiresAt < now) {
    await db.session.delete({ where: { id } });
    return null;
  }

  return session;
}

export async function revokeSession(token: string): Promise<void> {
  const id = hashToken(token);
  await db.session.delete({ where: { id } }).catch(() => {
    // Ignore not found
  });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

export async function deleteExpiredSessions(): Promise<void> {
  await db.session.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
}
