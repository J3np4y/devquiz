import type { Difficulty, Question, Topic } from '../../scripts/content/schema.ts';

export type { Difficulty, Question, Topic };

export type Bank = readonly Question[];

/** Devuelve un número en [0, 1). Se inyecta para que la selección sea reproducible en tests. */
export type Rng = () => number;

export type ChallengeMode = 'mixed' | 'filtered' | 'review';

export interface ChallengeFilters {
  topic?: Topic;
  difficulty?: Difficulty;
}

export interface Answer {
  optionId: string;
  correct: boolean;
  /** Milisegundos desde la época. */
  at: number;
}

export interface SessionQuestion {
  questionId: string;
  /** Orden en que se muestran las opciones. Se guarda para conservarlo al reanudar. */
  optionOrder: string[];
  answer?: Answer;
}

export type SessionStatus = 'active' | 'completed' | 'abandoned';

export interface Session {
  id: string;
  mode: ChallengeMode;
  status: SessionStatus;
  startedAt: number;
  finishedAt?: number;
  currentIndex: number;
  questions: SessionQuestion[];
}

export const SCHEMA_VERSION = 1;

/** Los fallos y las estadísticas no se guardan: se calculan a partir de las sesiones. */
export interface Progress {
  schemaVersion: typeof SCHEMA_VERSION;
  sessions: Session[];
}

export const emptyProgress = (): Progress => ({ schemaVersion: SCHEMA_VERSION, sessions: [] });
