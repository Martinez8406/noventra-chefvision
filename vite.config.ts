import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = { ...process.env, ...loadEnv(mode, '.', '') };
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: { '/api': 'http://localhost:3001' },
        // SPA fallback: Stripe przekierowuje na http://localhost:3000/success
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
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
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
