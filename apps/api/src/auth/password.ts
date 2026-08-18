import { hash, verify } from '@node-rs/argon2';

// OWASP argon2id baseline parameters (https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
// memoryCost: 19456 KiB, timeCost: 2 iterations, parallelism: 1 thread
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(hash, plain);
  } catch {
    return false;
  }
}
