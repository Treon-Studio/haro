import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://mock_user:mock_pw@localhost:5432/mock_db",
      JWT_SECRET: "3e7f4c71823ebfa8d167df3c92c85b1a03e7f4c71823ebfa8d167df3c92c85b1a",
    },
  },
})
