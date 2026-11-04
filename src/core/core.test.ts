import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadBank } from '../../scripts/content/load.ts';
import { computeStats, failedQuestions } from './history.ts';
import {
  CHALLENGE_SIZE,
  countMatching,
  selectFiltered,
  selectMixed,
  selectReview,
  shuffle,
} from './selection.ts';
import {
  activeSession,
  advance,
  answerCurrent,
  createSession,
  currentQuestion,
  discardActive,
  reconcileActive,
  sessionResult,
  startSession,
} from './session.ts';
import {
  STORAGE_KEY,
  browserStorage,
  canSave,
  clearProgress,
  loadProgress,
  migrate,
  requestPersistentStorage,
  saveProgress,
  type StorageLike,
} from './storage.ts';
import {
  emptyProgress,
  type ChallengeMode,
  type Difficulty,
  type Progress,
  type Question,
  type Rng,
  type Session,
  type Topic,
} from './types.ts';

/** Generador con semilla, para que los tests sean reproducibles. */
const seeded = (seed: number): Rng => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const makeQuestion = (
  id: string,
  topic: Topic = 'javascript',
  difficulty: Difficulty = 'principiante',
  type: 'concept' | 'code' = 'concept',
): Question => ({
  id,
  topic,
  difficulty,
  type,
  prompt: `¿${id}?`,
  options: [
    { id: 'a', text: 'Sí' },
    { id: 'b', text: 'No' },
    { id: 'c', text: 'Quizá' },
  ],
  correct: 'a',
  explanation: 'Porque sí.',
});

/** Sesión ya respondida. Cada entrada es [pregunta, acierto, momento]. */
const answered = (
  answers: [string, boolean, number][],
  mode: ChallengeMode = 'mixed',
  status: Session['status'] = 'completed',
): Session => ({
  id: `s-${answers[0]?.[2] ?? 0}-${mode}`,
  mode,
  status,
  startedAt: 0,
  currentIndex: 0,
  questions: answers.map(([questionId, correct, at]) => ({
    questionId,
    optionOrder: ['a', 'b', 'c'],
    answer: { optionId: correct ? 'a' : 'b', correct, at },
  })),
});

const memoryStorage = (initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } => {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
};

const started = (questions: Question[], mode: ChallengeMode = 'mixed'): Progress =>
  startSession(
    emptyProgress(),
    createSession({ mode, questions, now: 1, rng: seeded(1) }) as Session,
    1,
  );

describe('selectFiltered', () => {
  const bank = [
    makeQuestion('a1', 'sql', 'avanzado'),
    makeQuestion('a2', 'sql', 'avanzado'),
    makeQuestion('b1', 'sql', 'principiante'),
    makeQuestion('c1', 'python', 'avanzado'),
  ];

  it('filtra por tema y dificultad', () => {
    const ids = selectFiltered(bank, { topic: 'sql', difficulty: 'avanzado' }, [], seeded(1))
      .map((question) => question.id)
      .sort();
    expect(ids).toEqual(['a1', 'a2']);
  });

  it('filtra por un solo criterio', () => {
    expect(selectFiltered(bank, { topic: 'sql' }, [], seeded(1))).toHaveLength(3);
    expect(selectFiltered(bank, { difficulty: 'avanzado' }, [], seeded(1))).toHaveLength(3);
  });

  it('devuelve las disponibles si son menos que el tamaño del reto, y nada si no hay', () => {
    expect(selectFiltered(bank, { topic: 'python' }, [], seeded(1))).toHaveLength(1);
    expect(selectFiltered(bank, { topic: 'testing' }, [], seeded(1))).toEqual([]);
    expect(countMatching(bank, { topic: 'sql' })).toBe(3);
  });

  it('limita el reto a su tamaño', () => {
    const large = Array.from({ length: 30 }, (_, index) => makeQuestion(`q${index}`));
    expect(selectFiltered(large, {}, [], seeded(1))).toHaveLength(CHALLENGE_SIZE);
  });

  it('prioriza las no vistas y después las vistas hace más tiempo', () => {
    const questions = ['nueva', 'reciente', 'antigua'].map((id) => makeQuestion(id));
    const sessions = [answered([['reciente', true, 200], ['antigua', true, 100]])];

    for (let seed = 0; seed < 20; seed++) {
      expect(selectFiltered(questions, {}, sessions, seeded(seed), 1)[0]?.id).toBe('nueva');
      const two = selectFiltered(questions, {}, sessions, seeded(seed), 2).map((q) => q.id);
      expect(two.sort()).toEqual(['antigua', 'nueva']);
    }
  });
});

describe('selectMixed con el banco real', () => {
  const { questions: bank, errors } = loadBank(
    fileURLToPath(new URL('../../content/questions/', import.meta.url)),
  );

  it('cumple las reglas de variedad con cualquier semilla', () => {
    expect(errors).toEqual([]);

    for (let seed = 0; seed < 300; seed++) {
      const picked = selectMixed(bank, [], seeded(seed));
      expect(picked).toHaveLength(CHALLENGE_SIZE);
      expect(new Set(picked.map((q) => q.id)).size).toBe(CHALLENGE_SIZE);
      expect(new Set(picked.map((q) => q.topic)).size).toBeGreaterThanOrEqual(3);
      expect(picked.filter((q) => q.type === 'code').length).toBeGreaterThanOrEqual(3);
      expect(new Set(picked.map((q) => q.difficulty)).size).toBeGreaterThan(1);
    }
  });

  it('mantiene la variedad cuando solo quedan por ver preguntas de un nivel', () => {
    const others = bank.filter((q) => q.difficulty !== 'principiante');
    const sessions = [answered(others.map((q, index) => [q.id, true, index + 1]))];

    for (let seed = 0; seed < 50; seed++) {
      const picked = selectMixed(bank, sessions, seeded(seed));
      expect(new Set(picked.map((q) => q.difficulty)).size).toBeGreaterThan(1);
      expect(new Set(picked.map((q) => q.topic)).size).toBeGreaterThanOrEqual(3);
      expect(picked.filter((q) => q.type === 'code').length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('selectMixed con bancos pequeños', () => {
  it('usa lo disponible aunque no pueda repartir por temas', () => {
    const bank = [makeQuestion('a'), makeQuestion('b')];
    expect(selectMixed(bank, [], seeded(1))).toHaveLength(2);
  });

  it('devuelve una lista vacía si no hay preguntas', () => {
    expect(selectMixed([], [], seeded(1))).toEqual([]);
  });
});

describe('selectReview', () => {
  const bank = Array.from({ length: 15 }, (_, index) => makeQuestion(`q${index}`));

  it('devuelve hasta 10, primero las falladas hace más tiempo', () => {
    const sessions = [answered(bank.map((q, index) => [q.id, false, 100 - index]))];
    const ids = selectReview(bank, sessions).map((q) => q.id);
    expect(ids).toHaveLength(10);
    expect(ids[0]).toBe('q14');
    expect(ids[9]).toBe('q5');
  });

  it('devuelve una lista vacía si no hay fallos', () => {
    expect(selectReview(bank, [])).toEqual([]);
  });
});

describe('failedQuestions', () => {
  const bank = ['a', 'b'].map((id) => makeQuestion(id));

  it('registra los fallos', () => {
    expect(failedQuestions([answered([['a', false, 5]])], bank)).toEqual([
      { questionId: 'a', failedAt: 5 },
    ]);
  });

  it.each<ChallengeMode>(['mixed', 'filtered', 'review'])('quita la pregunta al acertarla en modo %s', (mode) => {
    const sessions = [answered([['a', false, 5]]), answered([['a', true, 6]], mode)];
    expect(failedQuestions(sessions, bank)).toEqual([]);
  });

  it('la devuelve a la lista si se falla de nuevo', () => {
    const sessions = [
      answered([['a', false, 1]]),
      answered([['a', true, 2]], 'review'),
      answered([['a', false, 3]]),
    ];
    expect(failedQuestions(sessions, bank)).toEqual([{ questionId: 'a', failedAt: 3 }]);
  });

  it('usa el orden temporal de las respuestas, no el de las sesiones', () => {
    const sessions = [answered([['a', true, 9]]), answered([['a', false, 2]])];
    expect(failedQuestions(sessions, bank)).toEqual([]);
  });

  it('cuenta los fallos de retos abandonados', () => {
    const sessions = [answered([['a', false, 1]], 'mixed', 'abandoned')];
    expect(failedQuestions(sessions, bank)).toHaveLength(1);
  });

  it('ignora preguntas que ya no existen', () => {
    expect(failedQuestions([answered([['borrada', false, 1]])], bank)).toEqual([]);
  });
});

describe('computeStats', () => {
  const bank = [makeQuestion('js1'), makeQuestion('js2'), makeQuestion('py1', 'python')];

  it('no da precisión si no hay respuestas', () => {
    expect(computeStats([], bank)).toEqual({
      answered: 0,
      correct: 0,
      accuracy: null,
      completed: 0,
      byTopic: {},
    });
  });

  it('calcula los totales y la precisión global y por tema', () => {
    const stats = computeStats(
      [answered([['js1', true, 1], ['js2', false, 2], ['py1', true, 3], ['js1', true, 4]])],
      bank,
    );
    expect(stats).toMatchObject({ answered: 4, correct: 3, accuracy: 0.75, completed: 1 });
    expect(stats.byTopic.javascript?.accuracy).toBeCloseTo(2 / 3);
    expect(stats.byTopic.python).toEqual({ answered: 1, correct: 1, accuracy: 1 });
  });

  it('excluye el repaso', () => {
    const stats = computeStats([answered([['js1', true, 1]], 'review')], bank);
    expect(stats).toMatchObject({ answered: 0, completed: 0, accuracy: null });
  });

  it('cuenta las respuestas de un reto abandonado, pero no como completado', () => {
    const stats = computeStats([answered([['js1', true, 1]], 'mixed', 'abandoned')], bank);
    expect(stats).toMatchObject({ answered: 1, completed: 0 });
  });

  it('ignora preguntas que ya no existen', () => {
    expect(computeStats([answered([['borrada', true, 1]])], bank).answered).toBe(0);
  });
});

describe('ciclo del reto', () => {
  const questions = ['a', 'b'].map((id) => makeQuestion(id));
  const [first, second] = questions as [Question, Question];

  it('no crea un reto sin preguntas', () => {
    expect(createSession({ mode: 'mixed', questions: [], now: 1, rng: seeded(1) })).toBeNull();
  });

  it('baraja las opciones sin perder ninguna', () => {
    const orders = Array.from({ length: 20 }, (_, seed) =>
      createSession({ mode: 'mixed', questions, now: 1, rng: seeded(seed) })?.questions[0]?.optionOrder.join(''),
    );
    expect(new Set(orders).size).toBeGreaterThan(1);
    for (const order of orders) {
      expect([...(order ?? '')].sort().join('')).toBe('abc');
    }
  });

  it('marca si la respuesta es correcta', () => {
    const right = answerCurrent(started(questions), first, 'a', 2);
    expect(currentQuestion(activeSession(right) as Session)?.answer).toEqual({
      optionId: 'a',
      correct: true,
      at: 2,
    });
    const wrong = answerCurrent(started(questions), first, 'b', 2);
    expect(currentQuestion(activeSession(wrong) as Session)?.answer?.correct).toBe(false);
  });

  it('no permite cambiar una respuesta dada', () => {
    const once = answerCurrent(started(questions), first, 'b', 2);
    const twice = answerCurrent(once, first, 'a', 3);
    expect(currentQuestion(activeSession(twice) as Session)?.answer).toMatchObject({
      optionId: 'b',
      at: 2,
    });
  });

  it('ignora una opción inexistente o una pregunta que no es la actual', () => {
    const progress = started(questions);
    expect(answerCurrent(progress, first, 'z', 2)).toEqual(progress);
    expect(answerCurrent(progress, second, 'a', 2)).toEqual(progress);
  });

  it('no avanza sin responder', () => {
    const progress = started(questions);
    expect(advance(progress, 2)).toEqual(progress);
  });

  it('avanza y se completa tras la última pregunta', () => {
    let progress = answerCurrent(started(questions), first, 'a', 2);
    progress = advance(progress, 3);
    expect(activeSession(progress)?.currentIndex).toBe(1);

    progress = answerCurrent(progress, second, 'b', 4);
    progress = advance(progress, 5);
    expect(activeSession(progress)).toBeNull();
    expect(progress.sessions[0]).toMatchObject({ status: 'completed', finishedAt: 5 });
    expect(sessionResult(progress.sessions[0] as Session)).toEqual({ total: 2, answered: 2, correct: 1 });
  });

  it('al descartar conserva las respuestas y no cuenta como completado', () => {
    const progress = discardActive(answerCurrent(started(questions), first, 'a', 2), 3);
    expect(activeSession(progress)).toBeNull();
    expect(progress.sessions[0]?.status).toBe('abandoned');
    expect(computeStats(progress.sessions, questions)).toMatchObject({ answered: 1, completed: 0 });
  });

  it('al empezar un reto descarta el anterior', () => {
    const next = createSession({ mode: 'mixed', questions, now: 9, rng: seeded(2) }) as Session;
    const progress = startSession(started(questions), next, 9);
    expect(progress.sessions.map((session) => session.status)).toEqual(['abandoned', 'active']);
    expect(activeSession(progress)?.id).toBe(next.id);
  });
});

describe('reconcileActive', () => {
  const questions = ['a', 'b', 'c'].map((id) => makeQuestion(id));
  const first = questions[0] as Question;

  it('no cambia nada si el banco es el mismo', () => {
    const progress = started(questions);
    expect(reconcileActive(progress, questions, 2)).toEqual(progress);
  });

  it('quita las preguntas eliminadas y conserva la actual', () => {
    let progress = advance(answerCurrent(started(questions), first, 'a', 2), 3);
    progress = reconcileActive(progress, questions.filter((q) => q.id !== 'a'), 4);
    const session = activeSession(progress) as Session;
    expect(session.questions.map((q) => q.questionId)).toEqual(['b', 'c']);
    expect(currentQuestion(session)?.questionId).toBe('b');
  });

  it('pasa a la primera pendiente si se elimina la actual', () => {
    const progress = reconcileActive(started(questions), questions.filter((q) => q.id !== 'a'), 2);
    expect(currentQuestion(activeSession(progress) as Session)?.questionId).toBe('b');
  });

  it('completa el reto si solo quedan preguntas respondidas', () => {
    let progress = advance(answerCurrent(started(questions), first, 'a', 2), 3);
    progress = reconcileActive(progress, [first], 4);
    expect(progress.sessions[0]).toMatchObject({ status: 'completed', finishedAt: 4 });
  });

  it('abandona el reto si no queda ninguna pregunta', () => {
    const progress = reconcileActive(started(questions), [], 2);
    expect(progress.sessions[0]).toMatchObject({ status: 'abandoned', questions: [] });
  });

  it('actualiza las opciones de una pregunta modificada', () => {
    const edited: Question = {
      ...first,
      options: [
        { id: 'a', text: 'Sí' },
        { id: 'd', text: 'Nueva' },
      ],
    };
    const progress = reconcileActive(started(questions), [edited, ...questions.slice(1)], 2);
    const order = activeSession(progress)?.questions[0]?.optionOrder;
    expect([...(order ?? [])].sort()).toEqual(['a', 'd']);
  });
});

describe('persistencia', () => {
  const stored = (value: unknown) => memoryStorage({ [STORAGE_KEY]: JSON.stringify(value) });

  it('empieza vacío si no hay datos', () => {
    expect(loadProgress(memoryStorage())).toEqual({ progress: emptyProgress(), status: 'ok' });
  });

  it('recupera lo guardado, incluido un reto en curso', () => {
    const storage = memoryStorage();
    const questions = [makeQuestion('a'), makeQuestion('b')];
    const progress = answerCurrent(started(questions), questions[0] as Question, 'a', 2);

    expect(saveProgress(storage, progress)).toBe(true);
    const loaded = loadProgress(storage);
    expect(loaded).toEqual({ progress, status: 'ok' });
    expect(activeSession(loaded.progress)?.questions[0]?.answer?.correct).toBe(true);
  });

  it.each([
    ['JSON no válido', '{no es json'],
    ['un valor que no es un objeto', '[1, 2]'],
    ['sesiones con formato incorrecto', JSON.stringify({ schemaVersion: 1, sessions: [{ id: 1 }] })],
    ['sin versión', JSON.stringify({ sessions: [] })],
    ['una versión sin migración', JSON.stringify({ schemaVersion: 0, sessions: [] })],
  ])('trata como corruptos los datos con %s', (_name, raw) => {
    const result = loadProgress(memoryStorage({ [STORAGE_KEY]: raw }));
    expect(result).toEqual({ progress: emptyProgress(), status: 'corrupt' });
    expect(canSave(result.status)).toBe(true);
  });

  it('no sobrescribe datos de una versión posterior', () => {
    const result = loadProgress(stored({ schemaVersion: 99, sessions: [] }));
    expect(result).toEqual({ progress: emptyProgress(), status: 'newer' });
    expect(canSave(result.status)).toBe(false);
  });

  it('no falla si el almacenamiento no está disponible', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('sin espacio');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };

    expect(loadProgress(broken).status).toBe('unavailable');
    expect(loadProgress(null).status).toBe('unavailable');
    expect(canSave('unavailable')).toBe(false);
    expect(saveProgress(broken, emptyProgress())).toBe(false);
    expect(saveProgress(null, emptyProgress())).toBe(false);
    expect(clearProgress(broken)).toBe(false);
  });

  it('borra el progreso guardado', () => {
    const storage = memoryStorage();
    saveProgress(storage, started([makeQuestion('a')]));
    expect(clearProgress(storage)).toBe(true);
    expect(storage.data).toEqual({});
  });

  describe('requestPersistentStorage', () => {
    const manager = (persisted: boolean, granted: boolean) => {
      const calls = { persist: 0 };
      return {
        calls,
        persisted: async () => persisted,
        persist: async () => {
          calls.persist += 1;
          return granted;
        },
      };
    };

    it('no vuelve a pedirlo si ya está concedido', async () => {
      const fake = manager(true, true);
      expect(await requestPersistentStorage(fake)).toBe(true);
      expect(fake.calls.persist).toBe(0);
    });

    it('lo pide si aún no está concedido, y acepta una negativa', async () => {
      const denied = manager(false, false);
      expect(await requestPersistentStorage(denied)).toBe(false);
      expect(denied.calls.persist).toBe(1);
      expect(await requestPersistentStorage(manager(false, true))).toBe(true);
    });

    it('no falla si el navegador no lo admite o da error', async () => {
      expect(await requestPersistentStorage(undefined)).toBe(false);
      const broken = {
        persisted: async () => {
          throw new Error('no disponible');
        },
        persist: async () => true,
      };
      expect(await requestPersistentStorage(broken)).toBe(false);
    });
  });

  it('browserStorage devuelve null fuera de un navegador', () => {
    expect(browserStorage()).toBeNull();
  });

  it('migra paso a paso hasta la versión actual', () => {
    const result = migrate(
      { schemaVersion: 1, a: 1 },
      {
        1: (data) => ({ ...data, schemaVersion: 2, b: 2 }),
        2: (data) => ({ ...data, schemaVersion: 3, c: 3 }),
      },
      3,
    );
    expect(result).toEqual({ schemaVersion: 3, a: 1, b: 2, c: 3 });
  });

  it('no migra si falta un paso', () => {
    expect(migrate({ schemaVersion: 1 }, {}, 2)).toBeNull();
  });
});

describe('shuffle', () => {
  it('no modifica la lista original y conserva sus elementos', () => {
    const items = [1, 2, 3, 4];
    const result = shuffle(items, seeded(3));
    expect(items).toEqual([1, 2, 3, 4]);
    expect([...result].sort()).toEqual([1, 2, 3, 4]);
  });
});
