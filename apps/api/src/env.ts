import { config } from "dotenv";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../../../.env") });

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string(),
  SESSION_TTL_DAYS: z.coerce.number().default(30),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const missing = result.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`Environment validation failed:\n${missing}`);
  process.exit(1);
}

export const env = Object.freeze(result.data);
