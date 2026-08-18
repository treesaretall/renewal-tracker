import { describe, expect, it, beforeEach } from 'vitest';
import { API_ERROR_CODES } from '@renewal/shared';
import { db } from '../db.js';
import { createSession, SESSION_COOKIE_NAME } from '../auth/session.js';
import { buildTestClient } from '../test/client.js';
import type { User } from '../../generated/prisma/client.js';

describe('requireAuth middleware', () => {
  let testUser: User;

  beforeEach(async () => {
    testUser = await db.user.create({
      data: {
        email: `auth-test-${Date.now()}@example.com`,
        passwordHash: 'dummy-hash',
      },
    });
  });

  it('returns 401 with code UNAUTHENTICATED when no cookie present', async () => {
    const client = buildTestClient();
    const res = await client.get('/api/test/protected');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(API_ERROR_CODES.UNAUTHENTICATED);
  });

  it('returns 401 for garbage cookie', async () => {
    const client = buildTestClient();
    const res = await client
      .get('/api/test/protected')
      .set('Cookie', `${SESSION_COOKIE_NAME}=garbage-token`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(API_ERROR_CODES.UNAUTHENTICATED);
  });

  it('returns 401 for expired session', async () => {
    const { token } = await createSession(testUser.id);

    // Expire the session
    const allSessions = await db.session.findMany({
      where: { userId: testUser.id },
    });
    await db.session.update({
      where: { id: allSessions[0]!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const client = buildTestClient();
    const res = await client
      .get('/api/test/protected')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(API_ERROR_CODES.UNAUTHENTICATED);
  });

  it('returns 200 and handler sees correct user id for valid session', async () => {
    const { token } = await createSession(testUser.id);

    const client = buildTestClient();
    const res = await client
      .get('/api/test/protected')
      .set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(testUser.id);
  });
});
