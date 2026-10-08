import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      build: {
        target: 'es2020',
        outDir: 'dist',
        emptyOutDir: true,
        chunkSizeWarningLimit: 2500,
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: false,
          manifest: false,
          workbox: {
            maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2,ttf}'],
            cleanupOutdatedCaches: true,
            skipWaiting: true,
            clientsClaim: true,
            navigateFallback: '/index.html',
            navigateFallbackDenylist: [/^\/api\//],
          }
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
        dedupe: ['react', 'react-dom'],
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'react-dom/client'],
      }
    };
});
