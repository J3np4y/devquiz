import { failedQuestions, reviewDueAt } from './history.ts';
import type { Bank, ChallengeFilters, Question, Rng, Session } from './types.ts';

export const CHALLENGE_SIZE = 10;
const MIN_MIXED_TOPICS = 3;
const MIN_MIXED_CODE_RATIO = 0.3;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/** Primero las preguntas no vistas y después las que antes toca repasar. Los empates son aleatorios. */
function byFreshness(bank: Bank, sessions: readonly Session[], rng: Rng): Question[] {
  const due = reviewDueAt(sessions);
  return shuffle(bank, rng).sort((a, b) => (due.get(a.id) ?? -1) - (due.get(b.id) ?? -1));
}

export const matchesFilters = (question: Question, filters: ChallengeFilters) =>
  (!filters.topic || question.topic === filters.topic) &&
  (!filters.difficulty || question.difficulty === filters.difficulty);

/** Número de preguntas disponibles para un filtro. Permite avisar antes de iniciar el reto. */
export const countMatching = (bank: Bank, filters: ChallengeFilters) =>
  bank.filter((question) => matchesFilters(question, filters)).length;

/** Devuelve las disponibles aunque no lleguen a `size`, y una lista vacía si no hay ninguna. */
export function selectFiltered(
  bank: Bank,
  filters: ChallengeFilters,
  sessions: readonly Session[],
  rng: Rng,
  size = CHALLENGE_SIZE,
): Question[] {
  const matching = bank.filter((question) => matchesFilters(question, filters));
  return shuffle(byFreshness(matching, sessions, rng).slice(0, size), rng);
}

/** Hasta `size` preguntas falladas, primero las falladas hace más tiempo. */
export function selectReview(
  bank: Bank,
  sessions: readonly Session[],
  size = CHALLENGE_SIZE,
  filters: ChallengeFilters = {},
): Question[] {
  const questionsById = new Map(bank.map((question) => [question.id, question]));
  return failedQuestions(sessions, bank)
    .map(({ questionId }) => questionsById.get(questionId) as Question)
    .filter((question) => matchesFilters(question, filters))
    .slice(0, size);
}

/**
 * Reto variado: al menos 3 temas, un 30 % de preguntas con código y más de un nivel,
 * siempre que el banco lo permita. Dentro de esas reglas, prioriza las menos vistas.
 */
export function selectMixed(
  bank: Bank,
  sessions: readonly Session[],
  rng: Rng,
  size = CHALLENGE_SIZE,
): Question[] {
  const count = Math.min(size, bank.length);
  const ranked = byFreshness(bank, sessions, rng);
  const maxPerTopic = Math.ceil(count / MIN_MIXED_TOPICS);
  const codeQuota = Math.ceil(count * MIN_MIXED_CODE_RATIO);

  const picked: Question[] = [];
  const pick = (candidates: readonly Question[], limit: number, respectCap: boolean) => {
    for (const question of candidates) {
      if (picked.length >= limit) return;
      if (picked.includes(question)) continue;
      const inTopic = picked.filter((other) => other.topic === question.topic).length;
      if (respectCap && inTopic >= maxPerTopic) continue;
      picked.push(question);
    }
  };

  pick(ranked.filter((question) => question.type === 'code'), codeQuota, true);
  pick(ranked, count, true);
  // Un banco pequeño puede no permitir el reparto por temas.
  pick(ranked, count, false);

  ensureSeveralLevels(picked, ranked, codeQuota);
  return shuffle(picked, rng);
}

/** Si todas las preguntas son del mismo nivel, cambia una por la siguiente de otro nivel. */
function ensureSeveralLevels(picked: Question[], ranked: readonly Question[], codeQuota: number) {
  const level = picked[0]?.difficulty;
  if (!level || picked.some((question) => question.difficulty !== level)) return;

  const distinctTopics = (questions: readonly Question[]) =>
    new Set(questions.map((question) => question.topic)).size;
  const codeCount = (questions: readonly Question[]) =>
    questions.filter((question) => question.type === 'code').length;

  const requiredTopics = Math.min(distinctTopics(picked), MIN_MIXED_TOPICS);
  const requiredCode = Math.min(codeCount(picked), codeQuota);
  const replacements = ranked.filter((question) => question.difficulty !== level);

  for (const replacement of replacements) {
    for (let index = picked.length - 1; index >= 0; index--) {
      const candidate = picked.map((question, i) => (i === index ? replacement : question));
      if (distinctTopics(candidate) >= requiredTopics && codeCount(candidate) >= requiredCode) {
        picked[index] = replacement;
        return;
      }
    }
  }
}
