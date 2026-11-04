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

/** Momento en que se respondió por última vez cada pregunta. */
export function lastAnsweredAt(sessions: readonly Session[]): Map<string, number> {
  const seen = new Map<string, number>();
  for (const answer of chronologicalAnswers(sessions)) {
    seen.set(answer.questionId, answer.at);
  }
  return seen;
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
