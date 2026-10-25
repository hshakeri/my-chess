import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function baseAssetRewritePlugin(): Plugin {
  return {
    name: 'rewrite-base-assets',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && (req.url.startsWith('/wasm/') || req.url.startsWith('/models/') || req.url.startsWith('/pieces/'))) {
          req.url = '/my-chess' + req.url;
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), baseAssetRewritePlugin()],
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
  },
});
