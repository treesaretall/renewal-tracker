import type { Response } from 'express';

export function sendParsed<T>(
  res: Response,
  schema: { parse: (value: unknown) => T },
  value: unknown,
  status = 200,
): void {
  const parsed = schema.parse(value);
  res.status(status).json(parsed);
}
