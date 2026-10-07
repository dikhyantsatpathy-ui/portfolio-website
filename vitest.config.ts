import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The emulator suites must not run as part of the fast `npm test` gate:
    // they need a JDK and a Firestore emulator, which CI and local runs handle
    // through `npm run test:rules` instead.
    exclude: ["tests/firestore.rules.test.ts", "node_modules/**", "dist/**"],
    environment: "node",
  },
});
