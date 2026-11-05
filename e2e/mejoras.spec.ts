import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { SHORT_CHALLENGE, answer, bank, finishChallenge, next, openChallengeWith, readProgress, seed, seededProgress, startFiltered, statValues } from './helpers.ts';

const failedInTwoTopics = () => {
  const question = (topic: string) => {
    const found = bank.find((candidate) => candidate.topic === topic);
    if (!found) throw new Error(`Sin preguntas de ${topic}`);
    return found;
  };
  // Las posiciones impares del progreso sembrado son fallos.
  return seededProgress([question('sql'), question('sql'), question('python'), question('python')]);
};

test.describe('Exportar e importar el progreso', () => {
  const importFile = (page: import('@playwright/test').Page, content: string) =>
    page.getByLabel('Archivo de progreso').setInputFiles({
      name: 'progreso.json',
      mimeType: 'application/json',
      buffer: Buffer.from(content),
    });

  test('una copia exportada restaura el progreso después de reiniciarlo', async ({ page }) => {
    await openChallengeWith(page, SHORT_CHALLENGE);
    await finishChallenge(page, [true, false, true]);
    await page.getByRole('button', { name: 'Volver al inicio' }).first().click();
    const before = await statValues(page);

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar progreso' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^devquiz-progreso-\d{4}-\d{2}-\d{2}\.json$/);
    const content = readFileSync(await download.path(), 'utf8');

    await page.getByRole('button', { name: 'Reiniciar progreso' }).click();
    await page.getByRole('button', { name: 'Sí, borrar todo' }).click();
    expect(await statValues(page)).toEqual(['0', '—', '0']);

    // Sin progreso que perder, no hace falta confirmar.
    await importFile(page, content);
    await expect(page.getByRole('alert')).toHaveText('Progreso importado.');
    expect(await statValues(page)).toEqual(before);

    await page.reload();
    expect(await statValues(page)).toEqual(before);
  });

  test('pide confirmación antes de reemplazar un progreso existente', async ({ page }) => {
    await seed(page, seededProgress(bank.slice(0, 2)));
    const before = await statValues(page);
    await importFile(page, JSON.stringify(seededProgress(bank.slice(0, 4))));

    await expect(page.getByRole('button', { name: 'Cancelar importación' })).toBeFocused();
    await page.getByRole('button', { name: 'Cancelar importación' }).click();
    expect(await statValues(page)).toEqual(before);

    await importFile(page, JSON.stringify(seededProgress(bank.slice(0, 4))));
    await page.getByRole('button', { name: 'Sí, reemplazar' }).click();
    expect((await statValues(page))[0]).toBe('4');
    await expect.poll(async () => (await readProgress(page))?.sessions[0]?.questions.length).toBe(4);
  });

  for (const [name, content, message] of [
    ['un archivo que no es JSON', '{no es json', 'no es una copia válida'],
    ['un JSON con otra forma', '{"schemaVersion":1,"sessions":[{"id":1}]}', 'no es una copia válida'],
    ['un archivo de una versión posterior', '{"schemaVersion":999,"sessions":[]}', 'versión más reciente'],
  ] as const) {
    test(`rechaza ${name} sin tocar nada`, async ({ page }) => {
      await seed(page, seededProgress(bank.slice(0, 2)));
      const before = await statValues(page);
      await importFile(page, content);
      await expect(page.getByRole('alert')).toContainText(message);
      expect(await statValues(page)).toEqual(before);
    });
  }
});

test('el repaso se puede limitar a un tema', async ({ page }) => {
  await seed(page, failedInTwoTopics());
  const select = page.getByLabel('Qué repasar');
  await expect(select.locator('option')).toHaveText(['Todos los fallos (2)', 'Python (1)', 'SQL (1)']);

  await select.selectOption('sql');
  await page.getByRole('button', { name: 'Repasar fallos' }).click();
  await expect(page.getByText('Repaso de fallos · Pregunta 1 de 1')).toBeVisible();
  await expect(page.locator('.tags')).toContainText('SQL');
});

test.describe('Racha diaria', () => {
  test('no aparece sin respuestas de los últimos días', async ({ page }) => {
    await seed(page, seededProgress(bank.slice(0, 2)));
    await expect(page.locator('.streak')).toHaveCount(0);
  });

  test('cuenta el día de hoy al responder', async ({ page }) => {
    await openChallengeWith(page, SHORT_CHALLENGE);
    await answer(page, true);
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page.locator('.streak')).toHaveText('Racha de 1 día');
  });
});

test.describe('Reportar un error', () => {
  const question = SHORT_CHALLENGE[0] as string;

  test('el enlace identifica la pregunta y se abre aparte', async ({ page }) => {
    await openChallengeWith(page, SHORT_CHALLENGE);
    const link = page.getByRole('link', { name: 'Reportar un error en esta pregunta' });
    await expect(link).toHaveCount(0);

    await answer(page, true);
    await expect(link).toHaveAttribute('target', '_blank');
    const url = new URL((await link.getAttribute('href')) as string);
    expect(url.pathname).toBe('/J3np4y/devquiz/issues/new');
    expect(url.searchParams.get('title')).toContain(question);
  });

  test('Enter sobre el enlace no avanza de pregunta', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Solo aplica con teclado físico');
    await openChallengeWith(page, SHORT_CHALLENGE);
    await answer(page, true);
    await page.getByRole('link', { name: 'Reportar un error en esta pregunta' }).focus();
    const opening = page.context().waitForEvent('page');
    await page.keyboard.press('Enter');
    await (await opening).close();
    await expect(page.getByText('Pregunta 1 de 3')).toBeVisible();
  });

  test('también está en la revisión de resultados', async ({ page }) => {
    await openChallengeWith(page, SHORT_CHALLENGE);
    await finishChallenge(page, [true, true, true]);
    await expect(page.locator('.review-item .report-link')).toHaveCount(3);
  });
});

test.describe('Verdadero o falso', () => {
  const id = 'sql-vf-igual-null-001';

  test('muestra las dos opciones en orden fijo y corrige la respuesta', async ({ page, isMobile }) => {
    await openChallengeWith(page, [id, ...SHORT_CHALLENGE.slice(0, 1)]);
    await expect(page.locator('.tags')).toContainText('Verdadero o falso');
    await expect(page.locator('.option-text')).toHaveText(['Verdadero', 'Falso']);
    if (!isMobile) await expect(page.getByText('Responder con las teclas de 1 a 2')).toBeVisible();

    await answer(page, true);
    await expect(page.locator('.option--correct')).toContainText('Falso');
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map((violation) => violation.id)).toEqual([]);
    await next(page);
    await expect(page.getByText('Pregunta 2 de 2')).toBeVisible();
  });

  test('un reto real conserva el orden', async ({ page }) => {
    await page.goto('./');
    await startFiltered(page, 'sql', 'principiante');
    const progress = await readProgress(page);
    const session = progress?.sessions[0];
    for (const item of session?.questions ?? []) {
      if (item.questionId === id) expect(item.optionOrder).toEqual(['a', 'b']);
    }
  });
});
