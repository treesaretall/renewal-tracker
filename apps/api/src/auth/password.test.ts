import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it(
    'verifies a hash against its own plaintext',
    async () => {
      const plain = 'correct-horse-battery-staple';
      const hashed = await hashPassword(plain);
      expect(await verifyPassword(hashed, plain)).toBe(true);
    },
    { timeout: 10000 },
  );

  it(
    'fails verification for wrong password',
    async () => {
      const hashed = await hashPassword('correct-password');
      expect(await verifyPassword(hashed, 'wrong-password')).toBe(false);
    },
    { timeout: 10000 },
  );

  it(
    'produces different hashes for same password (salting)',
    async () => {
      const plain = 'same-password';
      const hash1 = await hashPassword(plain);
      const hash2 = await hashPassword(plain);
      expect(hash1).not.toBe(hash2);
    },
    { timeout: 10000 },
  );

  it('returns false for malformed hash', async () => {
    expect(await verifyPassword('not-a-hash', 'any-password')).toBe(false);
  });
});
