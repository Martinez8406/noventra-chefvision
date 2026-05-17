import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = { ...process.env, ...loadEnv(mode, '.', '') };
    const apiPort = env.STRIPE_API_PORT || '3002';
    return {
      server: {
        port: Number(env.VITE_DEV_PORT) || 3000,
        strictPort: false,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: `http://localhost:${apiPort}`,
            changeOrigin: true,
            timeout: 600_000,
            proxyTimeout: 600_000,
            configure: (proxy) => {
              proxy.on('proxyReq', (proxyReq) => {
                proxyReq.setTimeout(600_000);
              });
              proxy.on('proxyRes', (proxyRes) => {
                proxyRes.setTimeout(600_000);
              });
            },
          },
        },
        // SPA fallback: Stripe przekierowuje na BASE_URL/success (domyślnie :3001)
      },
      plugins: [
        react(),
        {
          name: 'spa-fallback-success',
          configureServer(server) {
            server.middlewares.use((req, res, next) => {
              const url = req.url?.split('?')[0] || '';
              if (url === '/success' || url === '/success/') {
                req.url = '/index.html';
              }
              next();
            });
          },
        },
      ],
      define: {
        'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
