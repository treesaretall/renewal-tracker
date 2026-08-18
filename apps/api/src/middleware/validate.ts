import type { Request, Response, NextFunction } from "express";
import type { z } from "zod";

// Express's default Request types are loose (body/query/params are `any`).
// This wrapper makes handlers honestly typed by narrowing them to validated schemas.
// Handlers should accept ValidatedRequest<TBody, TQuery, TParams> instead of raw Request.
export type ValidatedRequest<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
> = Omit<Request, "body" | "query" | "params"> & {
  body: TBody;
  query: TQuery;
  params: TParams;
};

interface ValidationSchemas {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      if (schemas.query) {
        const parsed = await schemas.query.parseAsync(req.query);
        // req.query has a getter, so we need to define a new property
        Object.defineProperty(req, "query", {
          value: parsed,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }

      if (schemas.params) {
        const parsed = await schemas.params.parseAsync(req.params);
        // req.params has a getter, so we need to define a new property
        Object.defineProperty(req, "params", {
          value: parsed,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
