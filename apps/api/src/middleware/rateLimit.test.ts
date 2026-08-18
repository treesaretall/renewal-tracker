import { describe, it, expect } from 'vitest';
import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import request from 'supertest';
import { API_ERROR_CODES } from '@renewal/shared';
import { ApiError } from '../errors.js';
import { errorHandler } from './errorHandler.js';

describe('authRateLimit', () => {
  it('returns 429 RATE_LIMITED after exceeding limit', async () => {
    // Create a test rate limiter with a low limit
    const testRateLimit = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        const email =
          typeof req.body === 'object' &&
          req.body !== null &&
          'email' in req.body
            ? String(req.body.email).toLowerCase().trim()
            : '';
        const ip = ipKeyGenerator(req.ip ?? '');
        return `${ip}:${email}`;
      },
      handler: (_req, _res, _next) => {
        throw ApiError.rateLimited(
          'Too many authentication attempts. Please try again later.',
        );
      },
      skipSuccessfulRequests: false,
    });

    const app = express();
    app.use(express.json());

    // Test endpoint that always fails (to simulate failed login attempts)
    app.post('/test-auth', testRateLimit, (_req, res) => {
      res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Failed' });
    });

    app.use(errorHandler);

    const credentials = {
      email: 'test@example.com',
      password: 'password',
    };

    // First attempt - should succeed (401 from handler, not rate limited)
    const res1 = await request(app).post('/test-auth').send(credentials);
    expect(res1.status).toBe(401);
    expect(res1.body.code).toBe('UNAUTHENTICATED');

    // Second attempt - should succeed (401 from handler)
    const res2 = await request(app).post('/test-auth').send(credentials);
    expect(res2.status).toBe(401);
    expect(res2.body.code).toBe('UNAUTHENTICATED');

    // Third attempt - should be rate limited
    const res3 = await request(app).post('/test-auth').send(credentials);
    expect(res3.status).toBe(429);
    expect(res3.body.code).toBe(API_ERROR_CODES.RATE_LIMITED);
    expect(res3.body.message).toContain('Too many');
  });

  it('keys rate limit by IP and email', async () => {
    const testRateLimit = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        const email =
          typeof req.body === 'object' &&
          req.body !== null &&
          'email' in req.body
            ? String(req.body.email).toLowerCase().trim()
            : '';
        const ip = ipKeyGenerator(req.ip ?? '');
        return `${ip}:${email}`;
      },
      handler: (_req, _res, _next) => {
        throw ApiError.rateLimited('Rate limited');
      },
      skipSuccessfulRequests: false,
    });

    const app = express();
    app.use(express.json());

    app.post('/test-auth', testRateLimit, (_req, res) => {
      res.status(401).json({ code: 'UNAUTHENTICATED' });
    });

    app.use(errorHandler);

    // First request with email1
    const res1 = await request(app)
      .post('/test-auth')
      .send({ email: 'user1@example.com' });
    expect(res1.status).toBe(401);

    // Second request with email1 - should be rate limited
    const res2 = await request(app)
      .post('/test-auth')
      .send({ email: 'user1@example.com' });
    expect(res2.status).toBe(429);

    // Request with different email - should succeed (different key)
    const res3 = await request(app)
      .post('/test-auth')
      .send({ email: 'user2@example.com' });
    expect(res3.status).toBe(401);
  });
});
