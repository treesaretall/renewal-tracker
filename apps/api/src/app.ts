import express from "express";
import cookieParser from "cookie-parser";
import { db } from "./db.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { authRouter } from "./routes/auth.js";
import { itemsRouter } from "./routes/items/index.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/health/db", async (_req, res) => {
    await db.user.findMany({ take: 1 });
    res.json({ db: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/items", requireAuth, itemsRouter);

  app.get("/api/test/protected", requireAuth, (req, res) => {
    res.json({ userId: req.user!.id });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
