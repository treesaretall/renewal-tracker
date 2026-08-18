import type { Request, Response } from "express";
import { API_ERROR_CODES } from "@renewal/shared";

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    code: API_ERROR_CODES.NOT_FOUND,
    message: `Route ${req.method} ${req.path} not found`,
  });
}
