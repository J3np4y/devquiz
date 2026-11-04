import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  SHORT_CHALLENGE,
  answer,
  bank,
  finishChallenge,
  next,
  openChallengeWith,
  optionIndex,
  seed,
  seededProgress,
  startFiltered,
  startQuick,
} from './helpers.ts';

async function expectNoViolations(page: Page, screen: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const summary = violations.map(
    (violation) =>
      `${violation.id} (${violation.nodes.length}): ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join(' | ')}`,
  );
  expect(summary, `Infracciones de axe en: ${screen}`).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('Axe y diseño', () => {
  test('el inicio vacío', async ({ page }) => {
    await page.goto('./');
    await expectNoViolations(page, 'inicio vacío');
    await expectNoHorizontalScroll(page);
  });

  test('el inicio con progreso, reto en curso y confirmación', async ({ page }) => {
    await page.goto('./');
    await startQuick(page);
    await answer(page, false);
    await page.getByRole('button', { name: 'Salir' }).click();
    await page.getByRole('button', { name: 'Reiniciar progreso' }).click();
    await expectNoViolations(page, 'inicio con progreso');
    await expectNoHorizontalScroll(page);
  });

  test('los avisos del inicio', async ({ page }) => {
    await seed(page, '{no es json');
    await expect(page.getByRole('alert')).toBeVisible();
    await expectNoViolations(page, 'inicio con aviso');
  });

  test('la pregunta antes y después de responder', async ({ page }) => {
    await openChallengeWith(page, ['sql-ventana-001', 'js-igualdad-001']);
    await expectNoViolations(page, 'pregunta sin responder');
    await expectNoHorizontalScroll(page);
    await answer(page, false);
    await expectNoViolations(page, 'pregunta fallada');
    await expectNoHorizontalScroll(page);
    await next(page);
    await answer(page, true);
    await expectNoViolations(page, 'pregunta acertada');
  });

  test('los resultados con todas las preguntas del banco', async ({ page }) => {
    await seed(page, seededProgress(bank));
    await page.goto('./#/resultado/semilla');
    await expect(page.locator('.review-item')).toHaveCount(bank.length);
    await expectNoViolations(page, 'resultados con todo el banco');
    await expectNoHorizontalScroll(page);
  });
});

test.describe('Teclado', () => {
  test.skip(({ isMobile }) => isMobile, 'Solo aplica con teclado físico');

  test('se puede completar un reto solo con teclado', async ({ page }) => {
    await page.goto('./');

    // Primer elemento interactivo tras el título.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Empezar reto rápido' })).toBeFocused();

    // Hasta el filtro de tema, y de ahí al botón del reto a medida.
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Tema')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Nivel')).toBeFocused();
    await page.getByLabel('Tema').selectOption('sql');
    await page.getByLabel('Nivel').selectOption('avanzado');
    await page.getByLabel('Nivel').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Empezar reto a medida' })).toBeFocused();
    await page.keyboard.press('Enter');

    for (let position = 1; position <= 7; position++) {
      await expect(page.getByText(`Pregunta ${position} de 7`)).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

      const key = String((await optionIndex(page, position !== 2)) + 1);
      await page.keyboard.press(key);

      const nextButton = page.getByRole('button', { name: /Siguiente pregunta|Ver resultados/ });
      await expect(nextButton).toBeFocused();
      await page.keyboard.press('Enter');
    }

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Has acertado 6 de 7');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });

  test('las opciones también se pueden elegir con Tab y Enter', async ({ page }) => {
    await page.goto('./');
    await startQuick(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

    // Salir, el posible bloque de código y la primera opción.
    const firstOption = page.locator('.option').first();
    for (let press = 0; press < 5; press++) {
      await page.keyboard.press('Tab');
      if (await firstOption.evaluate((element) => element === document.activeElement)) break;
    }
    await expect(firstOption).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.feedback')).toBeVisible();
  });

  test('ignora las teclas con modificador y las teclas fuera de rango', async ({ page }) => {
    await page.goto('./');
    await startFiltered(page, 'sql', 'avanzado');
    await page.keyboard.press('Control+1');
    await page.keyboard.press('Alt+2');
    await page.keyboard.press('9');
    await expect(page.locator('.feedback')).toHaveCount(0);
  });

  test('Enter no se salta una pregunta sin responder', async ({ page }) => {
    await page.goto('./');
    await startFiltered(page, 'sql', 'avanzado');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Pregunta 1 de 7')).toBeVisible();
    await expect(page.locator('.feedback')).toHaveCount(0);
  });

  test('el bloque de código se puede enfocar para desplazarlo', async ({ page }) => {
    await openChallengeWith(page, ['sql-ventana-001']);
    await expect(page.locator('.code pre')).toHaveAttribute('tabindex', '0');
  });

  test('el foco no se pierde al reiniciar o descartar', async ({ page }) => {
    await page.goto('./');
    await openChallengeWith(page, SHORT_CHALLENGE);
    await finishChallenge(page, [true, true, true]);
    await page.getByRole('button', { name: 'Volver al inicio' }).first().click();

    await page.getByRole('button', { name: 'Reiniciar progreso' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Reiniciar progreso' })).toBeFocused();

    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Sí, borrar todo' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

    await startQuick(page);
    await page.getByRole('button', { name: 'Salir' }).click();
    await page.getByRole('button', { name: 'Descartar' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });
});

test.describe('Móvil', () => {
  test.skip(({ isMobile }) => !isMobile, 'Solo aplica en móvil');

  test('el código largo se desplaza sin romper la página', async ({ page }) => {
    await openChallengeWith(page, ['sql-ventana-001']);
    const pre = page.locator('.code pre');
    await expect(pre).toHaveCSS('white-space', 'pre');
    const overflows = await pre.evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(overflows).toBe(true);
    await expectNoHorizontalScroll(page);
  });

  test('las opciones tienen un tamaño cómodo para el dedo', async ({ page }) => {
    await page.goto('./');
    await startQuick(page);
    for (const option of await page.locator('.option').all()) {
      const box = await option.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('se puede responder tocando la pantalla', async ({ page }) => {
    await page.goto('./');
    await startQuick(page);
    await page.locator('.option').first().tap();
    await expect(page.locator('.feedback')).toBeVisible();
  });
});
