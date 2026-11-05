import type { Answer, Bank, Question, Session, Topic } from './types.ts';

interface AnswerEvent extends Answer {
  questionId: string;
}

const chronologicalAnswers = (sessions: readonly Session[]): AnswerEvent[] =>
  sessions
    .flatMap((session) =>
      session.questions.flatMap((question) =>
        question.answer ? [{ ...question.answer, questionId: question.questionId }] : [],
      ),
    )
    .sort((a, b) => a.at - b.at);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días hasta volver a ver una pregunta, según cuántas veces seguidas se ha acertado. */
const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60];

/**
 * Repetición espaciada: cuándo conviene volver a ver cada pregunta respondida.
 * Cada acierto seguido aleja la fecha, y un fallo hace que toque de inmediato.
 */
export function reviewDueAt(sessions: readonly Session[]): Map<string, number> {
  const streaks = new Map<string, number>();
  const due = new Map<string, number>();

  for (const { questionId, correct, at } of chronologicalAnswers(sessions)) {
    const streak = correct ? (streaks.get(questionId) ?? 0) + 1 : 0;
    streaks.set(questionId, streak);
    const days =
      streak === 0 ? 0 : (REVIEW_INTERVALS_DAYS[Math.min(streak, REVIEW_INTERVALS_DAYS.length) - 1] as number);
    due.set(questionId, at + days * DAY_MS);
  }

  return due;
}

const localDay = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/**
 * Días seguidos con alguna respuesta, en la hora local y contando el repaso.
 * Si hoy aún no se ha respondido nada, la racha de ayer sigue viva.
 */
export function dailyStreak(sessions: readonly Session[], now: number): number {
  const days = new Set(chronologicalAnswers(sessions).map((answer) => localDay(new Date(answer.at))));

  const cursor = new Date(now);
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (days.has(localDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface FailedQuestion {
  questionId: string;
  failedAt: number;
}

/**
 * Preguntas falladas, primero las falladas hace más tiempo.
 * Una pregunta sale de la lista al acertarla en cualquier modo y vuelve si se falla de nuevo.
 * Se ignoran las que ya no existen en el banco.
 */
export function failedQuestions(sessions: readonly Session[], bank: Bank): FailedQuestion[] {
  const existing = new Set(bank.map((question) => question.id));
  const failed = new Map<string, number>();

  for (const answer of chronologicalAnswers(sessions)) {
    if (answer.correct) {
      failed.delete(answer.questionId);
    } else {
      failed.set(answer.questionId, answer.at);
    }
  }

  return [...failed]
    .filter(([questionId]) => existing.has(questionId))
    .map(([questionId, failedAt]) => ({ questionId, failedAt }))
    .sort((a, b) => a.failedAt - b.failedAt);
}

export interface TopicStats {
  answered: number;
  correct: number;
  /** Aciertos / respondidas, entre 0 y 1. Es null si no hay respuestas. */
  accuracy: number | null;
}

export interface Stats extends TopicStats {
  completed: number;
  byTopic: Partial<Record<Topic, TopicStats>>;
}

const accuracyOf = (correct: number, answered: number) => (answered === 0 ? null : correct / answered);

/**
 * Resumen del progreso. Solo cuenta los retos normales: el repaso repite preguntas
 * elegidas por haberse fallado, y las respuestas de retos abandonados sí se conservan.
 */
export function computeStats(sessions: readonly Session[], bank: Bank): Stats {
  const questionsById = new Map<string, Question>(bank.map((question) => [question.id, question]));
  const normal = sessions.filter((session) => session.mode !== 'review');
  const totals = new Map<Topic, { answered: number; correct: number }>();
  let answered = 0;
  let correct = 0;

  for (const session of normal) {
    for (const { questionId, answer } of session.questions) {
      const question = questionsById.get(questionId);
      if (!answer || !question) continue;

      const topic = totals.get(question.topic) ?? { answered: 0, correct: 0 };
      topic.answered += 1;
      answered += 1;
      if (answer.correct) {
        topic.correct += 1;
        correct += 1;
      }
      totals.set(question.topic, topic);
    }
  }

  const byTopic: Stats['byTopic'] = {};
  for (const [topic, values] of totals) {
    byTopic[topic] = { ...values, accuracy: accuracyOf(values.correct, values.answered) };
  }

  return {
    answered,
    correct,
    accuracy: accuracyOf(correct, answered),
    completed: normal.filter((session) => session.status === 'completed').length,
    byTopic,
  };
}
