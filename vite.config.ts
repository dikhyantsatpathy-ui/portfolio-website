import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      port: 3000,
      host: "0.0.0.0",
      hmr: process.env.DISABLE_HMR !== "true",
      watch: {
        // `.agents/` holds agent tooling, not app source. Watching it makes
        // Vite hit EBUSY on Windows and hard-crashes the dev server, so it is
        // ignored explicitly rather than left to fail.
        ignored: ["**/.agents/**", "**/dist/**"],
      },
    },
  };
});