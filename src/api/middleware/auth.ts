import { Request, Response, NextFunction } from "express";
import { env } from "../../config/env.js";

/**
 * Middleware to protect webhook endpoints with a static API key.
 * Reads from the Authorization: Bearer <key> header or X-API-Key header.
 */
export function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers["x-api-key"];

  let providedKey: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    providedKey = authHeader.slice(7);
  } else if (typeof apiKeyHeader === "string") {
    providedKey = apiKeyHeader;
  }

  if (!providedKey || providedKey !== env.WEBHOOK_API_KEY) {
    res.status(401).json({ error: "Unauthorized. Invalid or missing API key." });
    return;
  }

  next();
}
