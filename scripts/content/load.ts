import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { questionSchema, type Question } from './schema.ts';

export interface SourceFile {
  name: string;
  content: string;
}

export interface LoadResult {
  questions: Question[];
  errors: string[];
}

/** Valida los archivos de preguntas. Cada archivo es una lista YAML y se llama como su tema. */
export function parseBank(files: SourceFile[]): LoadResult {
  const questions: Question[] = [];
  const errors: string[] = [];
  const seenIds = new Map<string, string>();

  for (const file of files) {
    let items: unknown;
    try {
      items = parse(file.content);
    } catch (error) {
      errors.push(`${file.name}: YAML no válido: ${(error as Error).message}`);
      continue;
    }

    if (!Array.isArray(items)) {
      errors.push(`${file.name}: debe contener una lista de preguntas`);
      continue;
    }

    const expectedTopic = file.name.replace(/\.ya?ml$/, '');

    items.forEach((item: unknown, index) => {
      const label = (item as { id?: unknown } | null)?.id ?? `#${index + 1}`;
      const result = questionSchema.safeParse(item);

      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push(`${file.name} > ${String(label)} > ${issue.path.join('.')}: ${issue.message}`);
        }
        return;
      }

      const question = result.data;

      if (question.topic !== expectedTopic) {
        errors.push(`${file.name} > ${question.id}: el tema "${question.topic}" no coincide con el archivo`);
      }

      const previous = seenIds.get(question.id);
      if (previous) {
        errors.push(`${file.name} > ${question.id}: identificador repetido, ya usado en ${previous}`);
      }
      seenIds.set(question.id, file.name);

      questions.push(question);
    });
  }

  return { questions, errors };
}

export function loadBank(directory: string): LoadResult {
  const files = readdirSync(directory)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()
    .map((name) => ({ name, content: readFileSync(join(directory, name), 'utf8') }));

  return parseBank(files);
}
