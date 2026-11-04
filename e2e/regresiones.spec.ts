import { expect, test, type Page } from '@playwright/test';
import { STORAGE_KEY, SHORT_CHALLENGE, answer, finishChallenge, next, openChallengeWith, readProgress, startFiltered, startQuick, statValues } from './helpers.ts';

const home = (page: Page) => page.getByRole('heading', { name: 'Reto rápido' });
const sessionSummary = async (page: Page) =>
  (await readProgress(page))?.sessions.map(
    (session) => `${session.status}:${session.questions.filter((item) => item.answer).length}`,
  );

test.describe('Botón Atrás', () => {
  test('tras terminar un reto no queda atrapado en el inicio', async ({ page }) => {
    await page.goto('about:blank');
    await page.goto('./');
    await startFiltered(page, 'sql', 'avanzado');
    await finishChallenge(page, Array.from({ length: 7 }, () => true));

    await page.goBack();
    await expect(home(page)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL('about:blank');
  });

  test('una entrada que ya no tiene contenido no atrapa al usuario', async ({ page }) => {
    await page.goto('about:blank');
    await page.goto('./');
    await startQuick(page);
    await page.getByRole('button', { name: 'Salir' }).click();
    await page.getByRole('button', { name: 'Descartar' }).click();

    // Historial: vacío, inicio, reto (ya descartado) e inicio.
    await page.goBack();
    await expect(home(page)).toBeVisible();
    await page.goBack();
    await expect(home(page)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL('about:blank');
  });

  test('desde un reto vuelve al inicio, y Adelante lo retoma', async ({ page }) => {
    await page.goto('./');
    await startQuick(page);
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Reanudar' })).toBeVisible();
    await page.goForward();
    await expect(page.getByText('Pregunta 1 de 10')).toBeVisible();
  });
});

test.describe('Varias pestañas', () => {
  test('una pestaña no pierde lo que ha guardado la otra', async ({ page, context }) => {
    await page.goto('./');
    const other = await context.newPage();
    await other.goto('./');

    await startQuick(page);
    await answer(page, true);
    await next(page);
    await answer(page, false);

    await expect(other.getByText('2 de 10 preguntas respondidas')).toBeVisible();

    await startQuick(other);
    await answer(other, true);

    await expect.poll(() => sessionSummary(page)).toEqual(['abandoned:2', 'active:1']);
    await page.reload();
    expect(await sessionSummary(page)).toEqual(['abandoned:2', 'active:1']);
  });

  test('reiniciar en una pestaña no se deshace desde otra', async ({ page, context }) => {
    await openChallengeWith(page, SHORT_CHALLENGE);
    await finishChallenge(page, [true, true, true]);
    await page.getByRole('button', { name: 'Volver al inicio' }).first().click();

    const other = await context.newPage();
    await other.goto('./');
    await other.getByRole('button', { name: 'Reiniciar progreso' }).click();
    await other.getByRole('button', { name: 'Sí, borrar todo' }).click();

    await expect.poll(() => statValues(page)).toEqual(['0', '—', '0']);
    await startQuick(page);
    expect(await sessionSummary(page)).toEqual(['active:0']);
  });

  test('si otra pestaña descarta el reto, esta vuelve al inicio', async ({ page, context }) => {
    await page.goto('./');
    await startQuick(page);

    const other = await context.newPage();
    await other.goto('./');
    await other.getByRole('button', { name: 'Descartar' }).click();

    await expect(home(page)).toBeVisible();
  });

  test('otra pestaña que avanza se refleja sin perder la coherencia', async ({ page, context }) => {
    await openChallengeWith(page, SHORT_CHALLENGE);
    const other = await context.newPage();
    await other.goto('./#/reto');
    await answer(other, true);
    await next(other);

    await expect(page.getByText('Pregunta 2 de 3')).toBeVisible();
  });
});

test.describe('Aviso de guardado', () => {
  test('si no se puede guardar, avisa en la propia pantalla de pregunta', async ({ page }) => {
    await page.goto('./');
    await startQuick(page);
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('lleno', 'QuotaExceededError');
      };
    });
    await page.locator('.option').first().click();
    await expect(page.getByRole('alert')).toContainText('No se ha podido guardar');
  });
});

test.describe('Consejo de instalación', () => {
  const macUserAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const hint = (page: Page) => page.getByText('añade DevQuiz a la pantalla de inicio');
  const withTouchPoints = (page: Page, points: number) =>
    page.addInitScript((value) => {
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => value });
    }, points);

  test.describe('con agente de Mac', () => {
    test.use({ userAgent: macUserAgent });

    test('sale en un iPad, que se identifica como Mac', async ({ page }) => {
      await withTouchPoints(page, 5);
      await page.goto('./');
      await expect(hint(page)).toBeVisible();
    });

    test('no sale en un Mac de verdad', async ({ page }) => {
      await withTouchPoints(page, 0);
      await page.goto('./');
      await expect(hint(page)).toHaveCount(0);
    });
  });
});

test('los filtros tienen letra suficiente para que iOS no amplíe la página', async ({ page }) => {
  await page.goto('./');
  for (const label of ['Tema', 'Nivel']) {
    const size = await page.getByLabel(label).evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  }
});

test.describe('Atajos de teclado', () => {
  test.skip(({ isMobile }) => isMobile, 'Solo aplica con teclado físico');

  test('se pueden desactivar, y se recuerda al recargar', async ({ page }) => {
    await openChallengeWith(page, SHORT_CHALLENGE);
    const toggle = page.getByLabel(/Responder con las teclas/);
    await expect(toggle).toBeChecked();

    await toggle.uncheck();
    await page.keyboard.press('1');
    await expect(page.locator('.feedback')).toHaveCount(0);

    await page.reload();
    await expect(page.getByLabel(/Responder con las teclas/)).not.toBeChecked();
    await page.keyboard.press('1');
    await expect(page.locator('.feedback')).toHaveCount(0);

    // Las opciones siguen funcionando con el ratón.
    await page.locator('.option').first().click();
    await expect(page.locator('.feedback')).toBeVisible();
  });

  test('reiniciar el progreso no cambia la preferencia', async ({ page }) => {
    await openChallengeWith(page, SHORT_CHALLENGE);
    await page.getByLabel(/Responder con las teclas/).uncheck();
    await finishChallenge(page, [true, true, true]);
    await page.getByRole('button', { name: 'Volver al inicio' }).first().click();
    await page.getByRole('button', { name: 'Reiniciar progreso' }).click();
    await page.getByRole('button', { name: 'Sí, borrar todo' }).click();

    await openChallengeWith(page, SHORT_CHALLENGE);
    await expect(page.getByLabel(/Responder con las teclas/)).not.toBeChecked();
  });
});

test('un reto sin terminar no muestra resultados', async ({ page }) => {
  await page.goto('./');
  await startQuick(page);
  const id = (await readProgress(page))?.sessions[0]?.id;
  await page.evaluate((target) => {
    location.hash = `#/resultado/${target}`;
  }, id);
  await expect(home(page)).toBeVisible();
  await expect(page.getByText('Has acertado')).toHaveCount(0);
});

test('los datos manipulados con opciones repetidas no duplican botones', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key as string, value as string),
    [
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        sessions: [
          {
            id: 'x',
            mode: 'mixed',
            status: 'active',
            startedAt: 1,
            currentIndex: 0,
            questions: [{ questionId: 'js-tipos-001', optionOrder: ['a', 'a', 'b', 'c', 'd'] }],
          },
        ],
      }),
    ],
  );
  await page.reload();
  await page.goto('./#/reto');
  await expect(page.locator('.option')).toHaveCount(4);
});

test.describe('Entorno del código', () => {
  test('indica dónde se ejecuta cada fragmento', async ({ page }) => {
    await openChallengeWith(page, ['js-this-001', 'py-referencias-001']);
    await expect(page.locator('.code-caption')).toHaveText('JavaScript en Node.js 24');
    await answer(page, true);
    await next(page);
    await expect(page.locator('.code-caption')).toHaveText('Python 3.12');
  });

  test('explica el formato del resultado de SQL', async ({ page }) => {
    await openChallengeWith(page, ['sql-join-001']);
    await expect(page.locator('.code-caption')).toContainText('SQL en SQLite');
    await expect(page.locator('.code-caption')).toContainText('separa las columnas');
  });

  test('no explica ese formato si la pregunta no muestra un resultado', async ({ page }) => {
    await openChallengeWith(page, ['test-limites-001']);
    await expect(page.locator('.code-caption')).toHaveText('Python 3.12');
  });
});

test('la política de seguridad está activa y no bloquea nada de la app', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy|Content-Security-Policy/i.test(message.text())) violations.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`Content Security Policy: ${event.violatedDirective} ${event.blockedURI}`);
    });
  });

  await page.goto('./');
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain("base-uri 'none'");

  // El filtro se envía desde un formulario, y el código se colorea con atributos de estilo.
  await startFiltered(page, 'sql', 'avanzado');
  await page.goto('./#/');
  await openChallengeWith(page, SHORT_CHALLENGE.slice(0, 1));
  const colors = await page
    .locator('.code span span')
    .evaluateAll((spans) => new Set(spans.map((span) => getComputedStyle(span).color)).size);
  expect(colors).toBeGreaterThan(1);
  await finishChallenge(page, [true]);

  // Un script inyectado en línea debe quedar bloqueado.
  const executed = await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__injected = true;';
    document.head.append(script);
    return (window as unknown as { __injected?: boolean }).__injected === true;
  });
  expect(executed).toBe(false);
  expect(violations.filter((text) => !/script-src/.test(text))).toEqual([]);
});
