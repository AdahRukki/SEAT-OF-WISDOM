import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Generate a unique cache version once per build/dev-server start
const buildVersion = `sowa-${Date.now()}`;

// Recursively collect all built JS/CSS/font asset URLs (relative to web root,
// e.g. "/assets/index-abc123.js"). These become the "optional" precache list
// that is fetched best-effort during SW install.
function collectBuiltAssets(distRoot: string): string[] {
  const out: string[] = [];
  const walk = (absDir: string, urlDir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absPath = path.join(absDir, entry.name);
      const urlPath = `${urlDir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(absPath, urlPath);
      } else if (entry.isFile() && /\.(js|css|woff2?)$/.test(entry.name)) {
        out.push(urlPath);
      }
    }
  };
  walk(path.join(distRoot, 'assets'), '/assets');
  return out;
}

// Parse dist/public/index.html to find the asset URLs that the HTML directly
// references via <script src> and <link href>. These are the entry bundles
// that MUST be cached for the login page to render — they are pre-cached
// strictly (cache.addAll throws on any failure, so SW install rejects and
// retries on the next page load).
function collectCriticalAssetsFromHtml(distRoot: string): string[] {
  const htmlPath = path.join(distRoot, 'index.html');
  if (!fs.existsSync(htmlPath)) return [];
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const urls = new Set<string>();
  const patterns = [
    /<script[^>]+src=["']([^"']+)["']/g,
    /<link[^>]+href=["']([^"']+)["']/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const url = m[1];
      if (url.startsWith('/assets/')) urls.add(url);
    }
  }
  return Array.from(urls);
}

function applySwReplacements(
  content: string,
  criticalAssets: string[],
  optionalAssets: string[]
): string {
  // String.replace can interpret $-sequences in the replacement; use a
  // function form so JSON output is inserted verbatim.
  return content
    .replace('__SW_CACHE_VERSION__', () => buildVersion)
    .replace('__SW_CRITICAL_ASSETS__', () => JSON.stringify(criticalAssets))
    .replace('__SW_OPTIONAL_ASSETS__', () => JSON.stringify(optionalAssets));
}

const swVersionPlugin = (): Plugin => ({
  name: 'sw-version-inject',

  // Dev server: intercept requests to /service-worker.js and inject the version.
  // Dev mode uses unhashed module URLs and is not expected to work offline, so
  // the precache asset list is empty here.
  configureServer(server: ViteDevServer) {
    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
      if (req.url === '/service-worker.js') {
        const swPath = path.resolve(import.meta.dirname, 'client/public/service-worker.js');
        try {
          const content = fs.readFileSync(swPath, 'utf-8');
          const transformed = applySwReplacements(content, [], []);
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

  // Production build: replace placeholders in the copied SW file with the
  // build version and the list of hashed assets that must be pre-cached.
  closeBundle() {
    const distRoot = path.resolve(import.meta.dirname, 'dist/public');
    const swOut = path.join(distRoot, 'service-worker.js');
    if (!fs.existsSync(swOut)) return;

    const allAssets = collectBuiltAssets(distRoot);
    const critical = collectCriticalAssetsFromHtml(distRoot);
    const criticalSet = new Set(critical);
    const optional = allAssets.filter(a => !criticalSet.has(a));

    const content = fs.readFileSync(swOut, 'utf-8');
    const transformed = applySwReplacements(content, critical, optional);

    // Build-time assertion: every placeholder must be resolved, and the
    // critical asset list must be non-empty in production. This catches
    // build-config drift before users pay for it with broken offline.
    const unresolved = transformed.match(/__SW_(CACHE_VERSION|CRITICAL_ASSETS|OPTIONAL_ASSETS)__/);
    if (unresolved) {
      throw new Error(
        `[sw-version-inject] Service worker placeholder not replaced: ${unresolved[0]}`
      );
    }
    if (critical.length === 0) {
      throw new Error(
        '[sw-version-inject] No critical assets found in dist/public/index.html — ' +
        'service worker would not be able to render the login page offline.'
      );
    }

    fs.writeFileSync(swOut, transformed);
    console.log(
      `[sw-version-inject] Cache version: ${buildVersion} | ` +
      `Critical: ${critical.length} | Optional: ${optional.length}`
    );
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
