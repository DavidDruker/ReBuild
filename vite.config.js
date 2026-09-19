import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";

// Cache the complete built demo, including original photographs, for offline rehearsals.
function offlineDemo() {
  return {
    name: "rebuild-offline-demo",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle);
      const version = createHash("sha256")
        .update(files.join("|"))
        .digest("hex")
        .slice(0, 12);
      const assets = [
        ".",
        "./index.html",
        ...files.map((file) => `./${file}`),
        ...["doors", "lumber", "tile", "fixtures", "windows", "warehouse"].map(
          (type) => `./assets/reclaimed-${type}.jpg`,
        ),
        "./assets/rebuild-mark.png",
      ];
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `
const CACHE = 'rebuild-${version}';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(${JSON.stringify([...new Set(assets)])})).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('rebuild-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    if (event.request.mode !== 'navigate' && cached) return cached;
    try { const response = await fetch(event.request); if (response.ok) await cache.put(event.request, response.clone()); return response; }
    catch (error) { const fallback = cached || (event.request.mode === 'navigate' && await cache.match('./index.html')); if (fallback) return fallback; throw error; }
  }));
});`,
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), offlineDemo()],
  base: "./",
});
