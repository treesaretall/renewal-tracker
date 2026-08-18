import express from "express";
import { db } from "./db.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/health/db", async (_req, res) => {
    await db.user.findMany({ take: 1 });
    res.json({ db: "ok" });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
