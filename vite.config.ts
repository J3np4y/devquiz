import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages sirve el sitio en /devquiz/.
  base: '/devquiz/',
  plugins: [react()],
});
