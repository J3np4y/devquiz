import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const URL = `http://localhost:${PORT}/devquiz/`;
const inCi = Boolean(process.env.CI);

/** Las pruebas se ejecutan contra la compilación de producción. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: inCi,
  retries: inCi ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
    // Motor de Safari en un iPhone emulado. Se parece a Safari, pero no es Safari real.
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
    // Solo en CI: el equipo de desarrollo actual no permite lanzar el Firefox de Playwright.
    ...(inCi ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }] : []),
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: URL,
    reuseExistingServer: !inCi,
    timeout: 120_000,
  },
});
