import type { ChallengeMode, Difficulty, Question, Topic } from '../core/types.ts';

/** Pregunta tal como llega a la app: con el código ya resaltado al compilar. */
export type AppQuestion = Question & { codeHtml?: string };

/** Entorno en que CI verifica los fragmentos: el resultado de algunos depende de él. */
export const LANGUAGE_LABELS: Record<NonNullable<Question['language']>, string> = {
  javascript: 'JavaScript en Node.js 24',
  python: 'Python 3.12',
  sql: 'SQL en SQLite',
};

export const TOPIC_LABELS: Record<Topic, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  sql: 'SQL',
  fundamentos: 'Fundamentos y estructuras de datos',
  testing: 'Testing',
  diseno: 'Principios de diseño',
  arquitectura: 'Arquitectura de software',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
};

export const MODE_LABELS: Record<ChallengeMode, string> = {
  mixed: 'Reto rápido',
  filtered: 'Reto a medida',
  review: 'Repaso de fallos',
};

export const TOPICS = Object.keys(TOPIC_LABELS) as Topic[];
export const DIFFICULTIES = Object.keys(DIFFICULTY_LABELS) as Difficulty[];
