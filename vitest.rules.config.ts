import { defineConfig } from "vitest/config";

/**
 * Security-rules suite. Separate from the fast unit gate because it needs the
 * Firestore emulator, which needs a JDK. If `java` is missing this suite errors on
 * connect rather than silently passing.
 */
export default defineConfig({
  test: {
    include: ["tests/firestore.rules.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
