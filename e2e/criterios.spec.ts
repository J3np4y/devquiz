import { expect, test } from '@playwright/test';
import {
  SHORT_CHALLENGE,
  STORAGE_KEY,
  activeSession,
  answer,
  bank,
  currentQuestion,
  finishChallenge,
  next,
  openChallengeWith,
  optionIndex,
  readProgress,
  seed,
  sessionQuestions,
  startFiltered,
  startQuick,
  statValues,
} from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test.describe('1. Iniciar retos', () => {
  test('inicia un reto mixto de 10 preguntas', async ({ page }) => {
    await startQuick(page);
    await expect(page.getByText('Reto rápido · Pregunta 1 de 10')).toBeVisible();
  });

  test('un filtro limita las preguntas por tema y dificultad', async ({ page }) => {
    await startFiltered(page, 'sql', 'avanzado');
    await expect(page.getByText('Reto a medida · Pregunta 1 de 7')).toBeVisible();

    for (const question of sessionQuestions(await activeSession(page))) {
      expect(question.topic).toBe('sql');
      expect(question.difficulty).toBe('avanzado');
    }
  });

  test('avisa de que un filtro con pocas preguntas da un reto más corto', async ({ page }) => {
    await page.getByLabel('Tema').selectOption('python');
    await expect(page.getByText('El reto tendrá 10 preguntas.')).toBeVisible();
    await page.getByLabel('Nivel').selectOption('intermedio');
    const available = bank.filter((question) => question.topic === 'python' && question.difficulty === 'intermedio').length;
    await expect(page.getByText(`Solo hay ${available} preguntas con este filtro`)).toBeVisible();
  });
});

test('2. El reto mixto combina temas, código y niveles', async ({ page }) => {
  // Se repite porque la selección es aleatoria.
  for (let attempt = 0; attempt < 5; attempt++) {
    await startQuick(page);
    const questions = sessionQuestions(await activeSession(page));
    expect(new Set(questions.map((question) => question.topic)).size).toBeGreaterThanOrEqual(3);
    expect(questions.filter((question) => question.type === 'code').length).toBeGreaterThanOrEqual(3);
    expect(new Set(questions.map((question) => question.difficulty)).size).toBeGreaterThan(1);
    await page.getByRole('button', { name: 'Salir' }).click();
  }
});

test.describe('3. Feedback y explicación', () => {
  test('no se puede avanzar sin responder', async ({ page }) => {
    await startQuick(page);
    await expect(page.getByRole('button', { name: /Siguiente pregunta/ })).toHaveCount(0);
    await expect(page.locator('.feedback')).toHaveCount(0);
  });

  test('un acierto muestra el resultado y la explicación', async ({ page }) => {
    await startQuick(page);
    const question = await answer(page, true);
    await expect(page.getByRole('status')).toContainText('¡Correcto!');
    await expect(page.getByRole('status')).toContainText(question.explanation.replaceAll('`', '').slice(0, 30));
    await expect(page.locator('.option--correct')).toContainText('Correcta');
    await expect(page.getByRole('button', { name: 'Siguiente pregunta' })).toBeVisible();
  });

  test('un fallo señala la respuesta elegida y la correcta', async ({ page }) => {
    await startQuick(page);
    await answer(page, false);
    await expect(page.getByRole('status')).toContainText('Incorrecto');
    await expect(page.locator('.option--wrong')).toContainText('Tu respuesta');
    await expect(page.locator('.option--correct')).toContainText('Correcta');
  });

  test('una respuesta dada no se puede cambiar', async ({ page }) => {
    await startQuick(page);
    await answer(page, false);
    for (const option of await page.locator('.option').all()) {
      await expect(option).toBeDisabled();
    }
  });
});

test('4. El resumen permite revisar las respuestas', async ({ page }) => {
  await openChallengeWith(page, SHORT_CHALLENGE);
  await finishChallenge(page, [false, true, false]);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Has acertado 1 de 3');
  await expect(page.locator('.review-item')).toHaveCount(3);
  await expect(page.locator('.review-item--wrong')).toHaveCount(2);

  const wrong = page.locator('.review-item--wrong').first();
  await expect(wrong.getByText('Tu respuesta', { exact: true })).toBeVisible();
  await expect(wrong.getByText('Respuesta correcta')).toBeVisible();
  await expect(wrong.locator('.review-answers dd')).toHaveCount(2);

  const right = page.locator('.review-item--correct').first();
  await expect(right.getByText('Tu respuesta, correcta')).toBeVisible();
});

test.describe('5. Repaso de fallos', () => {
  test('el repaso aparece desactivado y explicado si no hay fallos', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Repasar fallos' })).toBeDisabled();
    await expect(page.getByText('Aún no tienes preguntas falladas')).toBeVisible();
  });

  test('una pregunta fallada sale de la lista al acertarla', async ({ page }) => {
    await openChallengeWith(page, SHORT_CHALLENGE);
    await finishChallenge(page, [false, true, true]);
    await page.getByRole('button', { name: 'Volver al inicio' }).first().click();
    await expect(page.getByText('Tienes 1 pregunta fallada')).toBeVisible();
    const before = await statValues(page);

    await page.getByRole('button', { name: 'Repasar fallos' }).click();
    await expect(page.getByText('Repaso de fallos · Pregunta 1 de 1')).toBeVisible();
    await finishChallenge(page, [true]);
    await expect(page.getByRole('button', { name: /Repasar fallos/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Volver al inicio' }).first().click();
    await expect(page.getByText('Aún no tienes preguntas falladas')).toBeVisible();
    // El repaso no altera las estadísticas.
    expect(await statValues(page)).toEqual(before);
  });

  test('sigue en la lista si se vuelve a fallar', async ({ page }) => {
    await openChallengeWith(page, SHORT_CHALLENGE);
    await finishChallenge(page, [false, true, true]);
    await page.getByRole('button', { name: /Repasar fallos \(1\)/ }).click();
    await finishChallenge(page, [false]);
    await expect(page.getByRole('button', { name: /Repasar fallos \(1\)/ })).toBeVisible();
  });
});

test.describe('6. Conservar y reiniciar el progreso', () => {
  test('recargar a mitad de reto conserva la pregunta y la respuesta', async ({ page }) => {
    await startQuick(page);
    await answer(page, false);
    await next(page);
    const question = await answer(page, true);

    await page.reload();

    await expect(page.getByText('Pregunta 2 de 10')).toBeVisible();
    await expect(page.locator('.feedback')).toContainText('¡Correcto!');
    expect((await currentQuestion(page)).question.id).toBe(question.id);
    await next(page);
    await expect(page.getByText('Pregunta 3 de 10')).toBeVisible();
  });

  test('el orden de las opciones se conserva al recargar', async ({ page }) => {
    await startQuick(page);
    const before = await page.locator('.option-text').allTextContents();
    await page.reload();
    await expect(page.locator('.option-text')).toHaveText(before);
  });

  test('las estadísticas se conservan al recargar', async ({ page }) => {
    await openChallengeWith(page, SHORT_CHALLENGE);
    await finishChallenge(page, [true, true, false]);
    await page.goto('./#/');
    await page.reload();
    expect(await statValues(page)).toEqual(['3', '67 %', '1']);
    await expect(page.getByRole('row', { name: /SQL/ })).toContainText('67 %');
  });

  test('salir ofrece reanudar el reto o descartarlo', async ({ page }) => {
    await startQuick(page);
    await answer(page, true);
    await page.getByRole('button', { name: 'Salir' }).click();

    await expect(page.getByText('1 de 10 preguntas respondidas')).toBeVisible();
    await page.getByRole('button', { name: 'Reanudar' }).click();
    await expect(page.getByText('Pregunta 1 de 10')).toBeVisible();
    await page.getByRole('button', { name: 'Salir' }).click();

    await page.getByRole('button', { name: 'Descartar' }).click();
    await expect(page.getByRole('button', { name: 'Reanudar' })).toHaveCount(0);
    // La respuesta se conserva, pero el reto no cuenta como completado.
    expect(await statValues(page)).toEqual(['1', '100 %', '0']);
  });

  test('reiniciar pide confirmación y borra el progreso', async ({ page }) => {
    await openChallengeWith(page, SHORT_CHALLENGE);
    await finishChallenge(page, [true, false, false]);
    await page.getByRole('button', { name: 'Volver al inicio' }).first().click();

    await page.getByRole('button', { name: 'Reiniciar progreso' }).click();
    await expect(page.getByText('¿Borrar todo tu progreso?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    expect(await statValues(page)).toEqual(['3', '33 %', '1']);

    await page.getByRole('button', { name: 'Reiniciar progreso' }).click();
    await page.getByRole('button', { name: 'Sí, borrar todo' }).click();
    expect(await statValues(page)).toEqual(['0', '—', '0']);
    expect(await readProgress(page)).toBeNull();

    await page.reload();
    expect(await statValues(page)).toEqual(['0', '—', '0']);
  });
});

test.describe('Navegación', () => {
  test('el botón Atrás tras terminar un reto no vuelve a él', async ({ page }) => {
    await openChallengeWith(page, SHORT_CHALLENGE);
    await finishChallenge(page, [true, true, true]);
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Reto rápido' })).toBeVisible();
  });

  test('una ruta desconocida lleva al inicio', async ({ page }) => {
    await page.goto('./#/resultado/no-existe');
    await expect(page.getByRole('heading', { name: 'Reto rápido' })).toBeVisible();
    await page.goto('./#/reto');
    await expect(page.getByRole('heading', { name: 'Reto rápido' })).toBeVisible();
  });

  test('el título de la página refleja la pantalla', async ({ page }) => {
    await expect(page).toHaveTitle('DevQuiz');
    await openChallengeWith(page, SHORT_CHALLENGE);
    await expect(page).toHaveTitle('Pregunta 1 de 3 · DevQuiz');
    await finishChallenge(page, [true, true, true]);
    await expect(page).toHaveTitle('Resultados · DevQuiz');
  });
});

test.describe('Datos guardados problemáticos', () => {
  test('con datos corruptos avisa y permite seguir', async ({ page }) => {
    await seed(page, '{no es json');
    await expect(page.getByRole('alert')).toContainText('No se ha podido leer');
    await startQuick(page);
    await answer(page, true);
    expect((await readProgress(page))?.sessions).toHaveLength(1);
  });

  test('no sobrescribe datos de una versión posterior', async ({ page }) => {
    const newer = JSON.stringify({ schemaVersion: 99, sessions: [] });
    await seed(page, newer);
    await expect(page.getByRole('alert')).toContainText('versión más reciente');
    await startQuick(page);
    await page.locator('.option').first().click();
    await expect(page.locator('.feedback')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(newer);
  });

  test('funciona si el navegador no permite guardar', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new Error('bloqueado');
      };
    });
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('no permite guardar');
    await startFiltered(page, 'sql', 'avanzado');
    for (let question = 0; question < 7; question++) {
      await page.locator('.option').first().click();
      await next(page);
    }
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Has acertado');
  });
});

test('la respuesta correcta nunca depende de una posición fija', async ({ page }) => {
  await startQuick(page);
  const session = await activeSession(page);
  const orders = new Set(session.questions.map((item) => item.optionOrder.join('')));
  expect(orders.size).toBeGreaterThan(1);
  expect(await optionIndex(page, true)).toBeGreaterThanOrEqual(0);
});
