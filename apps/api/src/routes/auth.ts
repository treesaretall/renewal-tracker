import { Router } from 'express';
import {
  signupSchema,
  loginSchema,
  publicUserSchema,
  DEFAULT_REMINDER_SETTINGS,
} from '@renewal/shared';
import { db } from '../db.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { ApiError } from '../errors.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import {
  createSession,
  revokeSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  deleteExpiredSessions,
} from '../auth/session.js';
import { sendParsed } from '../lib/respond.js';

export const authRouter = Router();

authRouter.post('/signup', validate({ body: signupSchema }), async (req, res) => {
  const { email, password } = req.body;

  // Check for duplicate email
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // This leaks account existence, but it's a deliberate trade-off for a local single-user tool
    // where a confusing "account already exists" message during signup is the worse outcome.
    throw ApiError.conflict('An account with that email already exists');
  }

  const passwordHash = await hashPassword(password);

  // Create user and settings in a transaction
  const user = await db.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    await tx.reminderSettings.create({
      data: {
        userId: newUser.id,
        defaultLeadTimeDays: DEFAULT_REMINDER_SETTINGS.defaultLeadTimeDays,
        weekStartsOn: DEFAULT_REMINDER_SETTINGS.weekStartsOn,
        dateFormat: DEFAULT_REMINDER_SETTINGS.dateFormat,
      },
    });

    // Create category lead time entries
    const categories = Object.keys(DEFAULT_REMINDER_SETTINGS.categoryLeadTimes);
    if (categories.length > 0) {
      await tx.categoryLeadTime.createMany({
        data: categories.map((category) => ({
          userId: newUser.id,
          category,
          leadTimeDays: DEFAULT_REMINDER_SETTINGS.defaultLeadTimeDays,
        })),
      });
    }

    return newUser;
  });

  // Create session and set cookie
  const { token, expiresAt } = await createSession(user.id);
  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));

  sendParsed(
    res,
    publicUserSchema,
    {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    },
    201,
  );
});

authRouter.post('/login', validate({ body: loginSchema }), async (req, res) => {
  const { email, password } = req.body;

  const user = await db.user.findUnique({ where: { email } });

  // Verify password even when user is absent (against a dummy hash) so response time
  // doesn't leak account existence. This is a timing-safe check.
  const hash = user?.passwordHash ?? '$argon2id$v=19$m=19456,t=2,p=1$dummy';
  const isValid = await verifyPassword(hash, password);

  if (!user || !isValid) {
    throw ApiError.unauthenticated('Email or password is incorrect');
  }

  // Opportunistic cleanup of expired sessions
  await deleteExpiredSessions();

  const { token, expiresAt } = await createSession(user.id);
  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));

  sendParsed(res, publicUserSchema, {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  });
});

authRouter.post('/logout', async (req, res) => {
  const token = req.cookies[SESSION_COOKIE_NAME] as string | undefined;

  if (token) {
    await revokeSession(token);
  }

  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.status(204).send();
});

authRouter.get('/me', requireAuth, (req, res) => {
  sendParsed(res, publicUserSchema, {
    id: req.user!.id,
    email: req.user!.email,
    createdAt: req.user!.createdAt.toISOString(),
  });
});
