import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../db.js';
import {
  createSession,
  findValidSession,
  revokeSession,
  revokeAllSessions,
  deleteExpiredSessions,
} from './session.js';

describe('session', () => {
  let testUserId: string;

  beforeEach(async () => {
    const user = await db.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'dummy-hash',
      },
    });
    testUserId = user.id;
  });

  it('finds a created session by its token', async () => {
    const { token } = await createSession(testUserId);
    const session = await findValidSession(token);

    expect(session).not.toBeNull();
    expect(session?.userId).toBe(testUserId);
    expect(session?.user.email).toContain('test-');
  });

  it('does not store the raw token in the Session table', async () => {
    const { token } = await createSession(testUserId);

    const allSessions = await db.session.findMany({
      where: { userId: testUserId },
    });

    expect(allSessions).toHaveLength(1);
    expect(allSessions[0]!.id).not.toBe(token);
    expect(allSessions[0]!.id).toHaveLength(64); // SHA-256 hex digest
  });

  it('returns null for expired session and removes it', async () => {
    const { token } = await createSession(testUserId);

    // Expire the session by setting expiresAt in the past
    const allSessions = await db.session.findMany({
      where: { userId: testUserId },
    });
    await db.session.update({
      where: { id: allSessions[0]!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await findValidSession(token);
    expect(result).toBeNull();

    // Verify it was removed
    const remaining = await db.session.findMany({
      where: { userId: testUserId },
    });
    expect(remaining).toHaveLength(0);
  });

  it('makes session unfindable after revoke', async () => {
    const { token } = await createSession(testUserId);

    await revokeSession(token);

    const result = await findValidSession(token);
    expect(result).toBeNull();
  });

  it('clears several sessions with revokeAllSessions', async () => {
    const { token: token1 } = await createSession(testUserId);
    const { token: token2 } = await createSession(testUserId);
    const { token: token3 } = await createSession(testUserId);

    await revokeAllSessions(testUserId);

    expect(await findValidSession(token1)).toBeNull();
    expect(await findValidSession(token2)).toBeNull();
    expect(await findValidSession(token3)).toBeNull();
  });

  it('deletes expired sessions with deleteExpiredSessions', async () => {
    const { token: activeToken } = await createSession(testUserId);

    // Create an expired session directly
    const expiredSession = await db.session.create({
      data: {
        id: 'expired-session-hash',
        userId: testUserId,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await deleteExpiredSessions();

    // Active session should still exist
    expect(await findValidSession(activeToken)).not.toBeNull();

    // Expired session should be gone
    const result = await db.session.findUnique({
      where: { id: expiredSession.id },
    });
    expect(result).toBeNull();
  });
});
