import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { configDefaults, defineConfig } from 'vitest/config';
import { bankPlugin } from './scripts/content/bank-plugin.ts';

export default defineConfig({
  // GitHub Pages sirve el sitio en /devquiz/.
  base: '/devquiz/',
  plugins: [
    react(),
    bankPlugin(),
    VitePWA({
      // El service worker nuevo toma el control en silencio y la versión nueva se ve en la
      // siguiente visita. Así una actualización nunca recarga la página a mitad de una pregunta.
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // Sin esto, la primera visita no queda controlada y una versión nueva
        // no se aplicaría hasta cerrar todas las pestañas.
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        name: 'DevQuiz',
        short_name: 'DevQuiz',
        description: 'Repasa conocimientos de desarrollo en sesiones breves.',
        lang: 'es',
        display: 'standalone',
        theme_color: '#1f4fd8',
        background_color: '#f6f7f9',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
