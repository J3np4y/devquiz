import { expect, test, type Page } from '@playwright/test';
import { answer, finishChallenge, next, startFiltered, startQuick, statValues } from './helpers.ts';

/** Espera a que el service worker controle la página y haya guardado la app. */
async function waitForOfflineReady(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((resolve) =>
      navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
    );
  });
}

test.describe('8. Sin conexión', () => {
  test('tras la primera visita, la app carga y funciona sin red', async ({ page, context }) => {
    await page.goto('./');
    await waitForOfflineReady(page);

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Reto rápido' })).toBeVisible();
    await startFiltered(page, 'sql', 'avanzado');
    await finishChallenge(page, [true, false, true, true, true, true, true]);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Has acertado 6 de 7');

    await page.goto('./#/');
    await page.reload();
    expect(await statValues(page)).toEqual(['7', '86 %', '1']);
  });

  test('una ruta interna también carga sin red', async ({ page, context }) => {
    await page.goto('./');
    await waitForOfflineReady(page);
    await startQuick(page);
    await answer(page, true);

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByText('Pregunta 1 de 10')).toBeVisible();
    await expect(page.locator('.feedback')).toBeVisible();
    await next(page);
    await expect(page.getByText('Pregunta 2 de 10')).toBeVisible();
  });
});

test.describe('Instalación', () => {
  test('el manifest es válido y sus iconos existen', async ({ page, request, baseURL }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifestUrl = new URL(href ?? '', baseURL).href;
    const response = await request.get(manifestUrl);
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest).toMatchObject({ name: 'DevQuiz', lang: 'es', display: 'standalone' });
    expect(new URL(manifest.scope, manifestUrl).pathname).toBe('/devquiz/');
    expect(new URL(manifest.start_url, manifestUrl).pathname).toBe('/devquiz/');

    for (const icon of manifest.icons) {
      const image = await request.get(new URL(icon.src, manifestUrl).href);
      expect(image.ok(), icon.src).toBe(true);
      expect(image.headers()['content-type']).toContain('image/png');
    }

    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true);
  });

  test.describe('en iPhone', () => {
    test.use({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
    });

    test('aconseja añadir la app a la pantalla de inicio', async ({ page }) => {
      await page.goto('./');
      await expect(page.getByText('añade DevQuiz a la pantalla de inicio')).toBeVisible();
    });
  });

  test('fuera de iOS no muestra ese consejo', async ({ page, browserName, isMobile }) => {
    test.skip(browserName === 'webkit' && isMobile, 'Este proyecto emula un iPhone');
    await page.goto('./');
    await expect(page.getByText('añade DevQuiz a la pantalla de inicio')).toHaveCount(0);
  });
});

test('pide almacenamiento persistente al empezar un reto, no al abrir la app', async ({ page }) => {
  await page.addInitScript(() => {
    const calls = { persist: 0 };
    Object.assign(window, { persistCalls: calls });
    navigator.storage.persisted = async () => false;
    navigator.storage.persist = async () => {
      calls.persist += 1;
      return true;
    };
  });
  const persistCalls = () =>
    page.evaluate(() => (window as unknown as { persistCalls: { persist: number } }).persistCalls.persist);

  await page.goto('./');
  expect(await persistCalls()).toBe(0);
  await startQuick(page);
  await expect.poll(persistCalls).toBe(1);
});

test('no hace peticiones a terceros', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? '').origin;
  const external: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/^https?:/.test(url) && !url.startsWith(origin)) external.push(url);
  });

  await page.goto('./');
  await waitForOfflineReady(page);
  await startFiltered(page, 'sql', 'avanzado');
  await finishChallenge(page, [true, false, true, true, true, true, true]);
  await page.getByRole('button', { name: 'Volver al inicio' }).first().click();

  expect(external).toEqual([]);
});
