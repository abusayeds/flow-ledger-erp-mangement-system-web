import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Ensure production builds always have a real backend origin for /files images
  // even if the deploy host forgets to inject .env at build time.
  envPrefix: "VITE_",
  server: {
    port: 8080,

    allowedHosts: ["preview.syedbipul.me", "sabbir8080.ssh.bd" , "qyad-frontend.ssh.bd"],

    host: true,
    cors: true ,
    // Avoid noisy full-page reloads from watcher noise outside src.
    watch: {
      ignored: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.git/**",
        "**/coverage/**",
        "**/*.log",
        "**/AgentStores/**",
        "**/agent-transcripts/**",
      ],
    },
    // Disabled: this dev server is also viewed via public tunnel hosts, and
    // HMR/auto-reload was refreshing viewers' browsers on every source edit.
    hmr: false,
    proxy: {
      "/api": {
        target: "https://sabbir2000.ssh.bd",
        changeOrigin: true,
        secure: false,
      },
      "/files": {
        target: "https://sabbir2000.ssh.bd",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
