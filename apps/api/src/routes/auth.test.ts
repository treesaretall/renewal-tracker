import { describe, expect, it, beforeEach } from 'vitest';
import { API_ERROR_CODES, DEFAULT_REMINDER_SETTINGS } from '@renewal/shared';
import { db } from '../db.js';
import { buildTestClient } from '../test/client.js';
import { SESSION_COOKIE_NAME } from '../auth/session.js';

describe('POST /api/auth/signup', () => {
  it('creates user, returns 201, sets httpOnly cookie, body has no passwordHash', async () => {
    const client = buildTestClient();
    const res = await client.post('/api/auth/signup').send({
      email: 'new@example.com',
      password: 'secure-pass-123',
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.email).toBe('new@example.com');
    expect(res.body.createdAt).toBeDefined();

    // Assert passwordHash is not present by checking keys
    expect(Object.keys(res.body)).not.toContain('passwordHash');
    expect(Object.keys(res.body).sort()).toEqual(['createdAt', 'email', 'id']);

    // Check session cookie is set
    const cookies = res.headers['set-cookie'] as string[] | undefined;
    expect(cookies).toBeDefined();
    const sessionCookie = cookies?.find((c) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
  });

  it('returns 409 CONFLICT for existing email', async () => {
    await db.user.create({
      data: {
        email: 'existing@example.com',
        passwordHash: 'dummy-hash',
      },
    });

    const client = buildTestClient();
    const res = await client.post('/api/auth/signup').send({
      email: 'existing@example.com',
      password: 'secure-pass-123',
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(API_ERROR_CODES.CONFLICT);
    expect(res.body.message).toContain('already exists');
  });

  it('returns 422 with details naming "password" for short password', async () => {
    const client = buildTestClient();
    const res = await client.post('/api/auth/signup').send({
      email: 'test@example.com',
      password: 'short',
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
    expect(res.body.details).toBeDefined();
    expect(res.body.details.some((d: { path: string }) => d.path.includes('password'))).toBe(true);
  });

  it('normalizes email: signup with "TEST@Example.COM " then login with "test@example.com" succeeds', async () => {
    const client = buildTestClient();

    // Signup with mixed case and trailing space
    const signupRes = await client.post('/api/auth/signup').send({
      email: 'TEST@Example.COM ',
      password: 'secure-pass-123',
    });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.email).toBe('test@example.com');

    // Login with lowercase, no space
    const loginRes = await client.post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'secure-pass-123',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.email).toBe('test@example.com');
  });

  it('creates ReminderSettings with documented defaults', async () => {
    const client = buildTestClient();
    const res = await client.post('/api/auth/signup').send({
      email: 'test-settings@example.com',
      password: 'secure-pass-123',
    });

    expect(res.status).toBe(201);
    const userId = res.body.id;

    const settings = await db.reminderSettings.findUnique({
      where: { userId },
    });

    expect(settings).not.toBeNull();
    expect(settings?.defaultLeadTimeDays).toBe(
      DEFAULT_REMINDER_SETTINGS.defaultLeadTimeDays,
    );
    expect(settings?.weekStartsOn).toBe(
      DEFAULT_REMINDER_SETTINGS.weekStartsOn,
    );
    expect(settings?.dateFormat).toBe(DEFAULT_REMINDER_SETTINGS.dateFormat);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    const client = buildTestClient();
    await client.post('/api/auth/signup').send({
      email: 'login-test@example.com',
      password: 'correct-password-123',
    });
  });

  it('returns same 401 message for wrong password and unknown email', async () => {
    const client = buildTestClient();

    const wrongPasswordRes = await client.post('/api/auth/login').send({
      email: 'login-test@example.com',
      password: 'wrong-password',
    });

    const unknownEmailRes = await client.post('/api/auth/login').send({
      email: 'unknown@example.com',
      password: 'any-password-123',
    });

    expect(wrongPasswordRes.status).toBe(401);
    expect(unknownEmailRes.status).toBe(401);
    expect(wrongPasswordRes.body).toEqual(unknownEmailRes.body);
    expect(wrongPasswordRes.body.code).toBe(API_ERROR_CODES.UNAUTHENTICATED);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without cookie', async () => {
    const client = buildTestClient();
    const res = await client.get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(API_ERROR_CODES.UNAUTHENTICATED);
  });

  it('returns user with signup cookie', async () => {
    const client = buildTestClient();

    const signupRes = await client.post('/api/auth/signup').send({
      email: 'me-test@example.com',
      password: 'secure-pass-123',
    });

    expect(signupRes.status).toBe(201);

    // Extract session cookie
    const setCookie = signupRes.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const sessionCookie = cookies.find((c) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    );
    expect(sessionCookie).toBeDefined();

    // Use the cookie for /me request
    const meRes = await client
      .get('/api/auth/me')
      .set('Cookie', sessionCookie!);

    expect(meRes.status).toBe(200);
    expect(meRes.body.id).toBe(signupRes.body.id);
    expect(meRes.body.email).toBe('me-test@example.com');
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 204 and subsequent /me returns 401', async () => {
    const client = buildTestClient();

    const signupRes = await client.post('/api/auth/signup').send({
      email: 'logout-test@example.com',
      password: 'secure-pass-123',
    });

    const setCookie = signupRes.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const sessionCookie = cookies.find((c) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    );

    // Logout
    const logoutRes = await client
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie!);

    expect(logoutRes.status).toBe(204);

    // Try to use the same cookie for /me
    const meRes = await client
      .get('/api/auth/me')
      .set('Cookie', sessionCookie!);

    expect(meRes.status).toBe(401);
  });

  it('returns 204 even without cookie', async () => {
    const client = buildTestClient();
    const res = await client.post('/api/auth/logout');

    expect(res.status).toBe(204);
  });
});

describe('Rate limiting', () => {
  it('does not interfere with normal authentication flow', async () => {
    // Rate limiting is applied but with a high limit in test env (AUTH_RATE_LIMIT_MAX=1000).
    // This test verifies it doesn't break normal operation.
    // See rateLimit.test.ts for detailed rate limit behavior tests.
    const client = buildTestClient();

    const testEmail = `ratelimit-${Date.now()}@example.com`;

    const res = await client.post('/api/auth/login').send({
      email: testEmail,
      password: 'wrong-password-123',
    });

    // Should get 401 for wrong password, not 429
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(API_ERROR_CODES.UNAUTHENTICATED);
  });
});
