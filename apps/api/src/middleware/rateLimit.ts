import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { ApiError } from '../errors.js';
import { env } from '../env.js';

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // Key by IP + lowercased email to prevent account enumeration via rate limit differences
  // Use ipKeyGenerator to properly handle IPv6 addresses
  keyGenerator: (req: Request) => {
    const email =
      typeof req.body === 'object' && req.body !== null && 'email' in req.body
        ? String(req.body.email).toLowerCase().trim()
        : '';
    const ip = ipKeyGenerator(req.ip ?? '');
    return `${ip}:${email}`;
  },
  handler: (_req, _res, _next) => {
    throw ApiError.rateLimited('Too many authentication attempts. Please try again later.');
  },
  // Skip successful requests - only failed attempts count toward the limit
  skipSuccessfulRequests: false,
});
