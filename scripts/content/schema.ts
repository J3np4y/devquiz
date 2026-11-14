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

export const LANGUAGES = ['javascript', 'python', 'sql', 'java'] as const;

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

export const CURRICULUM_CATEGORIES = ['code', 'theory', 'interview'] as const;

const curriculumSchema = z.strictObject({
  week: z.number().int().min(1).max(12),
  category: z.enum(CURRICULUM_CATEGORIES),
});

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
    type: z.enum(['concept', 'code', 'truefalse', 'open']),
    language: z.enum(LANGUAGES).optional(),
    prompt: nonBlank,
    code: nonBlank.optional(),
    // La interfaz responde con las teclas 1-4.
    options: z.array(optionSchema).min(2).max(4).optional(),
    correct: z.string().optional(),
    explanation: nonBlank.refine(
      (value) => !POSITIONAL_REFERENCE.test(value),
      'no puede referirse a la posición de una opción',
    ),
    modelAnswer: nonBlank.optional(),
    curriculum: curriculumSchema.optional(),
    verify: z.enum(['output', 'error']).optional(),
  })
  .superRefine((question, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    if (question.type === 'open') {
      if (question.options) issue('options', 'no se admiten opciones en preguntas abiertas');
      if (question.correct !== undefined) {
        issue('correct', 'no se admite una opción correcta en preguntas abiertas');
      }
      if (!question.modelAnswer) issue('modelAnswer', 'es obligatoria en preguntas abiertas');
      if (question.code || question.language || question.verify) {
        issue('type', 'las preguntas abiertas no admiten código ni verificación automática');
      }
    } else {
      if (!question.options) {
        issue('options', 'es obligatorio en preguntas cerradas');
      } else {
        const optionIds = question.options.map((option) => option.id);
        if (new Set(optionIds).size !== optionIds.length) {
          issue('options', 'hay identificadores de opción repetidos');
        }

        const optionTexts = question.options.map((option) => option.text.trim());
        if (new Set(optionTexts).size !== optionTexts.length) {
          issue('options', 'hay textos de opción repetidos');
        }

        if (!question.correct || !optionIds.includes(question.correct)) {
          issue('correct', `no coincide con ninguna opción: "${question.correct ?? ''}"`);
        }
      }
      if (question.modelAnswer) issue('modelAnswer', 'solo se admite en preguntas abiertas');
    }

    if (question.type === 'code') {
      if (!question.code) issue('code', 'es obligatorio en preguntas de tipo code');
      if (!question.language) issue('language', 'es obligatorio en preguntas de tipo code');
    } else {
      if (question.code) issue('code', `no se admite en preguntas de tipo ${question.type}`);
      if (question.language) issue('language', `no se admite en preguntas de tipo ${question.type}`);
      if (question.verify) issue('verify', `no se admite en preguntas de tipo ${question.type}`);
    }

    if (question.verify && question.language === 'java') {
      issue('verify', 'la verificación automática no admite Java');
    }

    if (question.curriculum) {
      const { category } = question.curriculum;
      if (category === 'code' && question.type !== 'code') {
        issue('curriculum.category', 'las preguntas de código deben ser de tipo code');
      }
      if (category === 'theory' && !['concept', 'truefalse'].includes(question.type)) {
        issue('curriculum.category', 'las preguntas de teoría deben ser concept o truefalse');
      }
      if (category === 'interview' && question.type !== 'open') {
        issue('curriculum.category', 'las preguntas de entrevista deben ser abiertas');
      }
    } else if (question.type === 'open') {
      issue('curriculum', 'las preguntas abiertas deben pertenecer al temario de Reciclaje');
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
