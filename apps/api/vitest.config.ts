import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./prisma/test.db",
      WEB_ORIGIN: "http://localhost:5173",
      SESSION_TTL_DAYS: "30",
      MAX_UPLOAD_MB: "10",
      NODE_ENV: "test",
    },
  },
});
