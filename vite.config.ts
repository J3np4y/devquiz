import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { configDefaults, defineConfig } from 'vitest/config';
import { bankPlugin } from './scripts/content/bank-plugin.ts';

/**
 * GitHub Pages no permite cabeceras propias, así que la política va en una etiqueta meta.
 * `style-src-attr` es para los colores que Shiki escribe en atributos `style`.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Solo en producción: el servidor de desarrollo necesita estilos en línea y WebSockets. */
function contentSecurityPolicyPlugin(): Plugin {
  return {
    name: 'devquiz-content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  // GitHub Pages sirve el sitio en /devquiz/.
  base: '/devquiz/',
  plugins: [
    react(),
    bankPlugin(),
    contentSecurityPolicyPlugin(),
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
        // Identidad estable de la app instalada, igual al valor implícito anterior.
        id: '/devquiz/',
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
    coverage: {
      provider: 'v8',
      include: ['src/**', 'scripts/**'],
      exclude: ['**/*.test.*', 'scripts/check-content.ts', 'scripts/content/bank-plugin.ts', 'src/main.tsx', 'src/virtual-bank.ts'],
    },
  },
});
