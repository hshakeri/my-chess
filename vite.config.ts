import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function baseAssetRewritePlugin(): Plugin {
  return {
    name: 'rewrite-base-assets',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && (req.url.startsWith('/models/') || req.url.startsWith('/pieces/'))) {
          req.url = '/my-chess' + req.url;
        }
        next();
      });
    },
  };
}

/**
 * The dev server serves the lesson book from book/ (made by `npm run book` and `npm run book:pdf`)
 * where the published site has it, so the Book tab shows it locally too. A book not yet built is a
 * 404, not the app's own page.
 */
function lessonBookPlugin(): Plugin {
  const bookDir = path.resolve(__dirname, 'book');
  const types: Record<string, string> = { '.pdf': 'application/pdf', '.html': 'text/html; charset=utf-8' };
  return {
    name: 'serve-lesson-book',
    configureServer(server) {
      server.middlewares.use('/my-chess/book', (req, res) => {
        let name = '';
        try {
          name = decodeURIComponent((req.url ?? '/').split('?')[0]);
        } catch {
          name = '';
        }
        const file = path.resolve(bookDir, `.${name}`);
        const type = types[path.extname(file)];
        if (!type || !file.startsWith(bookDir + path.sep) || !fs.existsSync(file)) {
          res.statusCode = 404;
          res.end('The lesson book is not built: run npm run book and npm run book:pdf');
          return;
        }
        res.setHeader('Content-Type', type);
        res.setHeader('Content-Length', String(fs.statSync(file).size));
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), baseAssetRewritePlugin(), lessonBookPlugin()],
  base: '/my-chess/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    host: true,
    hmr: {
      overlay: false,
    },
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
    // The Book tab imports pdf.js only when it opens: bundle it up front, so a first visit never reloads the page
    include: ['pdfjs-dist/legacy/build/pdf.mjs'],
  },
});
