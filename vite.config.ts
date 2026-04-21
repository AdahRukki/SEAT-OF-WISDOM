import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Generate a unique cache version once per build/dev-server start
const buildVersion = `sowa-${Date.now()}`;

const swVersionPlugin = (): Plugin => ({
  name: 'sw-version-inject',

  // Dev server: intercept requests to /service-worker.js and inject the version
  configureServer(server: ViteDevServer) {
    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
      if (req.url === '/service-worker.js') {
        const swPath = path.resolve(import.meta.dirname, 'client/public/service-worker.js');
        try {
          const content = fs.readFileSync(swPath, 'utf-8');
          const transformed = content.replace('__SW_CACHE_VERSION__', buildVersion);
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Service-Worker-Allowed', '/');
          res.end(transformed);
        } catch {
          next();
        }
        return;
      }
      next();
    });
  },

  // Production build: replace the placeholder in the copied SW file
  closeBundle() {
    const swOut = path.resolve(import.meta.dirname, 'dist/public/service-worker.js');
    if (fs.existsSync(swOut)) {
      const content = fs.readFileSync(swOut, 'utf-8');
      fs.writeFileSync(swOut, content.replace('__SW_CACHE_VERSION__', buildVersion));
      console.log(`[sw-version-inject] Cache version set to: ${buildVersion}`);
    }
  },
});

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    swVersionPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
