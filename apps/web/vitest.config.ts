import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    // Projects configuration (storybook project will be added in Phase 9):
    // projects: [
    //   {
    //     name: "unit",
    //     environment: "jsdom",
    //     setupFiles: "./src/test/setup.ts",
    //     css: true,
    //   },
    // ],
  },
});
