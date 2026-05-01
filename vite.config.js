import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// During `npm run dev`, Vercel's serverless functions don't run — so we
// register a tiny middleware that handles `/api/news` exactly like the
// production function. The sheet ID stays server-side (read from .env via
// loadEnv → process.env, never `import.meta.env`) so the client never sees it.
function newsApiDevPlugin(env) {
  const SHEET_ID = env.SHEET_ID;
  const SHEET_TAB = env.SHEET_TAB || 'News';

  return {
    name: 'newssphere-news-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/news', async (req, res) => {
        if (!SHEET_ID) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'SHEET_ID not set in .env' }));
          return;
        }
        try {
          const url = new URL(req.url || '/', 'http://localhost');
          const q = url.searchParams.get('q') || '';
          const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_TAB)}`;
          const upstream = q ? `${base}&tq=${encodeURIComponent(q)}` : base;
          const r = await fetch(upstream, { cache: 'no-store' });
          const text = await r.text();
          res.statusCode = r.status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(text);
        } catch (err) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Sheet upstream fetch failed', detail: err.message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), newsApiDevPlugin(env)],
    server: { port: 5173, open: true },
    build: { outDir: 'dist', sourcemap: false, target: 'es2020' },
  };
});
