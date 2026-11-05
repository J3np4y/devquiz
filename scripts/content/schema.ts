import { z } from 'zod';

export const TOPICS = [
  'javascript',
  'python',
  'sql',
  'fundamentos',
  'testing',
  'diseno',
  'arquitectura',
] as const;

export const DIFFICULTIES = ['principiante', 'intermedio', 'avanzado'] as const;

export const LANGUAGES = ['javascript', 'python', 'sql'] as const;

/** Las opciones se barajan al mostrarlas, así que no pueden depender de su posición. */
const ORDER_DEPENDENT_OPTION =
  /\b(todas|ninguna)( de)? las anteriores\b|\bambas (opciones|respuestas)\b|\blas dos primeras\b|\b(opciones|respuestas) [a-d] y [a-d]\b/i;

const POSITIONAL_REFERENCE = /(primera|segunda|tercera|cuarta|última) opción|\bopción [a-d]\b/i;

/** Las preguntas de verdadero o falso usan siempre estas opciones, en este orden. */
export const TRUE_FALSE_OPTIONS = [
  { id: 'a', text: 'Verdadero' },
  { id: 'b', text: 'Falso' },
];

const nonBlank = z.string().refine((value) => value.trim().length > 0, 'no puede estar vacío');

const optionSchema = z.strictObject({
  id: z.string().regex(/^[a-z]$/, 'debe ser una sola letra minúscula'),
  text: nonBlank.refine(
    (value) => !ORDER_DEPENDENT_OPTION.test(value),
    'no puede depender del orden de las opciones',
  ),
});

export const questionSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'debe estar en kebab-case'),
    topic: z.enum(TOPICS),
    difficulty: z.enum(DIFFICULTIES),
    type: z.enum(['concept', 'code', 'truefalse']),
    language: z.enum(LANGUAGES).optional(),
    prompt: nonBlank,
    code: nonBlank.optional(),
    // La interfaz responde con las teclas 1-4.
    options: z.array(optionSchema).min(2).max(4),
    correct: z.string(),
    explanation: nonBlank.refine(
      (value) => !POSITIONAL_REFERENCE.test(value),
      'no puede referirse a la posición de una opción',
    ),
    verify: z.enum(['output', 'error']).optional(),
  })
  .superRefine((question, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    const optionIds = question.options.map((option) => option.id);
    if (new Set(optionIds).size !== optionIds.length) {
      issue('options', 'hay identificadores de opción repetidos');
    }

    const optionTexts = question.options.map((option) => option.text.trim());
    if (new Set(optionTexts).size !== optionTexts.length) {
      issue('options', 'hay textos de opción repetidos');
    }

    if (!optionIds.includes(question.correct)) {
      issue('correct', `no coincide con ninguna opción: "${question.correct}"`);
    }

    if (question.type === 'code') {
      if (!question.code) issue('code', 'es obligatorio en preguntas de tipo code');
      if (!question.language) issue('language', 'es obligatorio en preguntas de tipo code');
    } else {
      if (question.code) issue('code', `no se admite en preguntas de tipo ${question.type}`);
      if (question.language) issue('language', `no se admite en preguntas de tipo ${question.type}`);
      if (question.verify) issue('verify', `no se admite en preguntas de tipo ${question.type}`);
    }

    if (
      question.type === 'truefalse' &&
      JSON.stringify(question.options) !== JSON.stringify(TRUE_FALSE_OPTIONS)
    ) {
      issue('options', 'deben ser "a: Verdadero" y "b: Falso", en este orden');
    }
  });

export type Question = z.infer<typeof questionSchema>;
export type Topic = (typeof TOPICS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type Language = (typeof LANGUAGES)[number];
