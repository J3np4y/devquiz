import { shuffle } from './selection.ts';
import type {
  Bank,
  ChallengeFilters,
  ChallengeMode,
  Progress,
  Question,
  Rng,
  Session,
  SessionQuestion,
} from './types.ts';

export interface NewSession {
  mode: ChallengeMode;
  filters?: ChallengeFilters;
  questions: readonly Question[];
  now: number;
  rng: Rng;
}

/** Crea un reto con las opciones barajadas. Devuelve null si no hay preguntas. */
export function createSession({ mode, filters, questions, now, rng }: NewSession): Session | null {
  if (questions.length === 0) return null;

  return {
    id: `${now.toString(36)}-${Math.floor(rng() * 1e9).toString(36)}`,
    mode,
    ...(filters ? { filters } : {}),
    status: 'active',
    startedAt: now,
    currentIndex: 0,
    questions: questions.map((question) => ({
      questionId: question.id,
      optionOrder: shuffle(question.options.map((option) => option.id), rng),
    })),
  };
}

export const activeSession = (progress: Progress) =>
  progress.sessions.find((session) => session.status === 'active') ?? null;

export const currentQuestion = (session: Session): SessionQuestion | null =>
  session.questions[session.currentIndex] ?? null;

function updateActive(progress: Progress, update: (session: Session) => Session): Progress {
  return {
    ...progress,
    sessions: progress.sessions.map((session) =>
      session.status === 'active' ? update(session) : session,
    ),
  };
}

/** Descarta el reto en curso. Las respuestas ya dadas se conservan. */
export function discardActive(progress: Progress, now: number): Progress {
  return updateActive(progress, (session) => ({ ...session, status: 'abandoned', finishedAt: now }));
}

/** Empieza un reto. Solo puede haber uno en curso, así que descarta el anterior. */
export function startSession(progress: Progress, session: Session, now: number): Progress {
  const previous = discardActive(progress, now);
  return { ...previous, sessions: [...previous.sessions, session] };
}

/** Registra la respuesta a la pregunta actual. Una respuesta dada no se puede cambiar. */
export function answerCurrent(
  progress: Progress,
  question: Question,
  optionId: string,
  now: number,
): Progress {
  return updateActive(progress, (session) => {
    const current = currentQuestion(session);
    const validOption = question.options.some((option) => option.id === optionId);
    if (!current || current.answer || current.questionId !== question.id || !validOption) {
      return session;
    }

    const answer = { optionId, correct: optionId === question.correct, at: now };
    return {
      ...session,
      questions: session.questions.map((item, index) =>
        index === session.currentIndex ? { ...item, answer } : item,
      ),
    };
  });
}

/** Pasa a la siguiente pregunta, o completa el reto si era la última. Exige haber respondido. */
export function advance(progress: Progress, now: number): Progress {
  return updateActive(progress, (session) => {
    if (!currentQuestion(session)?.answer) return session;

    return session.currentIndex >= session.questions.length - 1
      ? { ...session, status: 'completed', finishedAt: now }
      : { ...session, currentIndex: session.currentIndex + 1 };
  });
}

export function sessionResult(session: Session) {
  const answered = session.questions.filter((question) => question.answer);
  return {
    total: session.questions.length,
    answered: answered.length,
    correct: answered.filter((question) => question.answer?.correct).length,
  };
}

/**
 * Adapta el reto en curso a un banco que puede haber cambiado desde que empezó:
 * quita las preguntas eliminadas y actualiza las opciones de las modificadas.
 */
export function reconcileActive(progress: Progress, bank: Bank, now: number): Progress {
  const questionsById = new Map(bank.map((question) => [question.id, question]));

  return updateActive(progress, (session) => {
    const currentId = currentQuestion(session)?.questionId;
    const questions = session.questions.flatMap((item) => {
      const question = questionsById.get(item.questionId);
      if (!question) return [];

      const ids = question.options.map((option) => option.id);
      const kept = item.optionOrder.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [{ ...item, optionOrder: [...kept, ...added] }];
    });

    if (questions.length === 0) {
      return { ...session, questions, currentIndex: 0, status: 'abandoned', finishedAt: now };
    }

    const sameCurrent = questions.findIndex((item) => item.questionId === currentId);
    const firstPending = questions.findIndex((item) => !item.answer);
    if (sameCurrent === -1 && firstPending === -1) {
      return {
        ...session,
        questions,
        currentIndex: questions.length - 1,
        status: 'completed',
        finishedAt: now,
      };
    }

    return { ...session, questions, currentIndex: sameCurrent !== -1 ? sameCurrent : firstPending };
  });
}
