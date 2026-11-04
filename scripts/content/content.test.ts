import { stringify } from 'yaml';
import { describe, expect, it } from 'vitest';
import { checkCoverage } from './coverage.ts';
import { parseBank } from './load.ts';
import { DIFFICULTIES, TOPICS, questionSchema, type Question } from './schema.ts';
import { runSnippet, verifyQuestion } from './verify.ts';

const concept = {
  id: 'js-prueba-001',
  topic: 'javascript',
  difficulty: 'principiante',
  type: 'concept',
  prompt: '¿Pregunta?',
  options: [
    { id: 'a', text: 'Uno' },
    { id: 'b', text: 'Dos' },
  ],
  correct: 'a',
  explanation: 'Porque sí.',
};

const code = (language: string, snippet: string, correctText: string, verify = 'output') =>
  questionSchema.parse({
    ...concept,
    type: 'code',
    language,
    code: snippet,
    verify,
    options: [
      { id: 'a', text: correctText },
      { id: 'b', text: 'otra cosa' },
    ],
  });

const parseOne = (question: object) =>
  parseBank([{ name: 'javascript.yaml', content: stringify([question]) }]);

describe('validador del banco', () => {
  it('acepta una pregunta bien formada', () => {
    const { questions, errors } = parseOne(concept);
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(1);
  });

  it.each([
    ['sin explicación', { explanation: undefined }, 'explanation'],
    ['con explicación vacía', { explanation: '  ' }, 'explanation'],
    ['con explicación que cita la última opción', { explanation: 'La última opción es un montículo.' }, 'explanation'],
    ['con explicación que cita la opción b', { explanation: 'La opción b es la correcta.' }, 'explanation'],
    ['con respuesta inexistente', { correct: 'z' }, 'correct'],
    ['con dificultad desconocida', { difficulty: 'experto' }, 'difficulty'],
    ['con un campo desconocido', { extra: 1 }, ''],
    ['con id que no es kebab-case', { id: 'Mi_Pregunta' }, 'id'],
    ['con una sola opción', { options: [{ id: 'a', text: 'Uno' }] }, 'options'],
    [
      'con cinco opciones',
      { options: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, text: `Texto ${id}` })) },
      'options',
    ],
    [
      'con ids de opción repetidos',
      { options: [{ id: 'a', text: 'Uno' }, { id: 'a', text: 'Dos' }] },
      'options',
    ],
    [
      'con textos de opción repetidos',
      { options: [{ id: 'a', text: 'Uno' }, { id: 'b', text: 'Uno' }] },
      'options',
    ],
    [
      'con opción que depende del orden',
      { options: [{ id: 'a', text: 'Uno' }, { id: 'b', text: 'Todas las anteriores' }] },
      'options',
    ],
    ['de código sin fragmento', { type: 'code', language: 'javascript' }, 'code'],
    ['de código sin lenguaje', { type: 'code', code: 'x' }, 'language'],
    ['conceptual con fragmento', { code: 'x' }, 'code'],
    ['conceptual con verificación', { verify: 'output' }, 'verify'],
  ])('rechaza una pregunta %s', (_name, change, field) => {
    const { errors } = parseOne({ ...concept, ...change });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).toContain(field);
  });

  it('rechaza identificadores repetidos entre archivos', () => {
    const { errors } = parseBank([
      { name: 'javascript.yaml', content: stringify([concept]) },
      { name: 'python.yaml', content: stringify([{ ...concept, topic: 'python' }]) },
    ]);
    expect(errors.join('\n')).toContain('identificador repetido');
  });

  it('rechaza una pregunta en el archivo de otro tema', () => {
    const { errors } = parseBank([
      { name: 'python.yaml', content: stringify([concept]) },
    ]);
    expect(errors.join('\n')).toContain('no coincide con el archivo');
  });

  it('informa de un YAML no válido', () => {
    const { errors } = parseBank([{ name: 'javascript.yaml', content: 'a: [' }]);
    expect(errors.join('\n')).toContain('YAML no válido');
  });
});

describe('verificador de código', () => {
  it.each([
    ['javascript', 'console.log(1 + 1);', '2'],
    ['python', 'print(1 + 1)', '2'],
    ['sql', 'SELECT 1 + 1;', '2'],
    ['javascript', 'console.log(1);\nconsole.log(2);', '1\n2'],
    ['sql', "CREATE TABLE t (a, b);\nINSERT INTO t VALUES (1, 'x'), (2, NULL);\nSELECT a, b FROM t;", '1|x\n2|NULL'],
  ])('acepta una respuesta correcta en %s', (language, snippet, correctText) => {
    expect(verifyQuestion(code(language, snippet, correctText))).toBeNull();
  });

  it.each([
    ['javascript', 'console.log(1 + 1);', '3'],
    ['python', 'print(1 + 1)', '3'],
    ['sql', 'SELECT 1 + 1;', '3'],
  ])('rechaza una respuesta incorrecta en %s', (language, snippet, correctText) => {
    expect(verifyQuestion(code(language, snippet, correctText))).toContain('la salida es "2"');
  });

  it('rechaza un fragmento que falla cuando se espera una salida', () => {
    expect(verifyQuestion(code('python', 'raise ValueError()', '1'))).toContain('el fragmento falló');
  });

  it('comprueba el tipo de error esperado', () => {
    expect(verifyQuestion(code('python', '{}["x"]', 'KeyError', 'error'))).toBeNull();
    expect(verifyQuestion(code('python', '{}["x"]', 'TypeError', 'error'))).toContain('se obtuvo');
    expect(verifyQuestion(code('python', 'print(1)', 'KeyError', 'error'))).toContain('terminó bien');
  });

  it('no acepta un error que solo se menciona en el mensaje de otro', () => {
    const snippet = 'raise ValueError("no es un TypeError")';
    expect(verifyQuestion(code('python', snippet, 'TypeError', 'error'))).toContain('se obtuvo');
    expect(verifyQuestion(code('python', snippet, 'ValueError', 'error'))).toBeNull();
    expect(verifyQuestion(code('javascript', 'null.x;', 'TypeError', 'error'))).toBeNull();
  });

  it('no expone a los fragmentos las variables de entorno, como los tokens de CI', () => {
    process.env.DEVQUIZ_SECRETO = 'valor';
    try {
      expect(runSnippet('javascript', 'console.log(process.env.DEVQUIZ_SECRETO)').stdout.trim()).toBe('undefined');
      expect(runSnippet('python', 'import os; print(os.environ.get("DEVQUIZ_SECRETO"))').stdout.trim()).toBe('None');
    } finally {
      delete process.env.DEVQUIZ_SECRETO;
    }
  });

  it('no ejecuta las preguntas sin verificación', () => {
    const question = code('python', 'raise ValueError()', '1');
    expect(verifyQuestion({ ...question, verify: undefined })).toBeNull();
  });
});

describe('cobertura', () => {
  const bank = (perCombination: number, type: 'concept' | 'code' = 'code'): Question[] =>
    TOPICS.flatMap((topic) =>
      DIFFICULTIES.flatMap((difficulty) =>
        Array.from({ length: perCombination }, (_, index) => ({
          ...concept,
          id: `${topic}-${difficulty}-${index}`,
          topic,
          difficulty,
          type,
        })),
      ),
    ) as Question[];

  it('acepta un banco que cumple los mínimos', () => {
    expect(checkCoverage(bank(3), 3)).toEqual([]);
  });

  it('señala las combinaciones con pocas preguntas', () => {
    const questions = bank(3).filter(
      (question) => !(question.topic === 'sql' && question.difficulty === 'avanzado'),
    );
    expect(checkCoverage(questions, 3)).toEqual(['sql / avanzado: 0 preguntas, mínimo 3']);
  });

  it('señala los temas con poco código', () => {
    expect(checkCoverage(bank(3, 'concept'), 3)).toContain('javascript: 0 % con código, mínimo 40 %');
  });
});
