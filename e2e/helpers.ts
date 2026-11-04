import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { loadBank } from '../scripts/content/load.ts';
import type { Question } from '../scripts/content/schema.ts';
import type { Progress, Session } from '../src/core/types.ts';

export const STORAGE_KEY = 'devquiz.progress';

export const { questions: bank } = loadBank(
  fileURLToPath(new URL('../content/questions/', import.meta.url)),
);

const questionById = (id: string) => {
  const question = bank.find((candidate) => candidate.id === id);
  if (!question) throw new Error(`Pregunta desconocida: ${id}`);
  return question;
};

export const readProgress = (page: Page) =>
  page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  }, STORAGE_KEY) as Promise<Progress | null>;

export async function activeSession(page: Page): Promise<Session> {
  const session = (await readProgress(page))?.sessions.find((item) => item.status === 'active');
  if (!session) throw new Error('No hay un reto en curso');
  return session;
}

export const sessionQuestions = (session: Session): Question[] =>
  session.questions.map((item) => questionById(item.questionId));

export async function currentQuestion(page: Page) {
  const session = await activeSession(page);
  const item = session.questions[session.currentIndex];
  if (!item) throw new Error('Índice de pregunta no válido');
  return { question: questionById(item.questionId), optionOrder: item.optionOrder };
}

/** Posición en pantalla de la opción correcta o de una incorrecta. */
export async function optionIndex(page: Page, correct: boolean) {
  const { question, optionOrder } = await currentQuestion(page);
  return optionOrder.findIndex((id) => (id === question.correct) === correct);
}

/** Responde pulsando la opción y devuelve la pregunta respondida. */
export async function answer(page: Page, correct: boolean) {
  const { question } = await currentQuestion(page);
  await page.locator('.option').nth(await optionIndex(page, correct)).click();
  await expect(page.locator('.feedback')).toBeVisible();
  return question;
}

export const next = (page: Page) =>
  page.getByRole('button', { name: /Siguiente pregunta|Ver resultados/ }).click();

/** Termina el reto en curso. Cada elemento indica si se acierta esa pregunta. */
export async function finishChallenge(page: Page, results: boolean[]) {
  for (const correct of results) {
    await answer(page, correct);
    await next(page);
  }
  await expect(page).toHaveURL(/#\/resultado\//);
}

export const startQuick = (page: Page) =>
  page.getByRole('button', { name: 'Empezar reto rápido' }).click();

export async function startFiltered(page: Page, topic: string, difficulty: string) {
  await page.getByLabel('Tema').selectOption(topic);
  await page.getByLabel('Nivel').selectOption(difficulty);
  await page.getByRole('button', { name: 'Empezar reto a medida' }).click();
}

export const statValues = (page: Page) => page.locator('.stats dd').allTextContents();

/** Progreso con las preguntas indicadas ya respondidas, alternando aciertos y fallos. */
export function seededProgress(questions: readonly Question[]): Progress {
  return {
    schemaVersion: 1,
    sessions: [
      {
        id: 'semilla',
        mode: 'mixed',
        status: 'completed',
        startedAt: 1,
        finishedAt: 2,
        currentIndex: 0,
        questions: questions.map((question, index) => {
          const correct = index % 2 === 0;
          const optionId = correct
            ? question.correct
            : (question.options.find((option) => option.id !== question.correct)?.id ?? '');
          return {
            questionId: question.id,
            optionOrder: question.options.map((option) => option.id),
            answer: { optionId, correct, at: index + 1 },
          };
        }),
      },
    ],
  };
}

/** Guarda los datos indicados y recarga para que la app los lea. */
export async function seed(page: Page, value: unknown) {
  await page.goto('./');
  await page.evaluate(
    ([key, raw]) => localStorage.setItem(key as string, raw as string),
    [STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value)],
  );
  await page.reload();
}

/** Abre un reto en curso con preguntas concretas, para no depender de la selección aleatoria. */
export async function openChallengeWith(page: Page, ids: string[]) {
  const progress: Progress = {
    schemaVersion: 1,
    sessions: [
      {
        id: 'en-curso',
        mode: 'filtered',
        status: 'active',
        startedAt: 1,
        currentIndex: 0,
        questions: ids.map((id) => ({
          questionId: id,
          optionOrder: questionById(id).options.map((option) => option.id),
        })),
      },
    ],
  };
  await seed(page, progress);
  await page.goto('./#/reto');
  await expect(page.locator('.option').first()).toBeVisible();
}
