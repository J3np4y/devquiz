import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { bankPlugin } from './scripts/content/bank-plugin.ts';

export default defineConfig({
  // GitHub Pages sirve el sitio en /devquiz/.
  base: '/devquiz/',
  plugins: [react(), bankPlugin()],
});
