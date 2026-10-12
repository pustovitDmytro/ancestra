import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const src = fileURLToPath(new URL('./src', import.meta.url));
/** Private trees win over public fixtures when names collide */
const gedRoots = [
  fileURLToPath(new URL('./ged', import.meta.url)),
  fileURLToPath(new URL('./tests/fixtures', import.meta.url)),
];

function serveGedDir(): Plugin {
  return {
    name: 'serve-ged-dir',
    configureServer(server) {
      server.middlewares.use('/ged', (req, res, _next) => {
        const raw = decodeURIComponent((req.url ?? '/').replace(/^\//, ''));
        const base = raw.split(/[/\\]/).pop() ?? '';
        if (!base || base !== raw || !base.endsWith('.ged')) {
          res.statusCode = 400;
          res.end('Expected /ged/<file>.ged');
          return;
        }
        const filePath = gedRoots
          .map((root) => join(root, base))
          .find((path, i) => path.startsWith(gedRoots[i]!) && existsSync(path));
        if (!filePath) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(readFileSync(filePath));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveGedDir()],
  resolve: {
    alias: { '@': src },
  },
});
