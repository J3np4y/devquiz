import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { codeToHtml } from 'shiki';
import type { Plugin } from 'vite';
import { loadBank } from './load.ts';

const VIRTUAL_ID = 'virtual:bank';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * Expone el banco como `virtual:bank`. Valida las preguntas y resalta el código al compilar,
 * de modo que ni el validador ni el resaltador llegan al navegador.
 */
export function bankPlugin(): Plugin {
  let directory = '';

  return {
    name: 'devquiz-bank',
    configResolved(config) {
      directory = join(config.root, 'content', 'questions');
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return undefined;

      for (const name of readdirSync(directory)) {
        this.addWatchFile(join(directory, name));
      }

      const { questions, errors } = loadBank(directory);
      if (errors.length > 0) {
        this.error(`Banco de preguntas no válido:\n${errors.join('\n')}`);
      }

      const compiled = await Promise.all(
        questions.map(async (question) => {
          if (!question.code || !question.language) return question;
          const codeHtml = await codeToHtml(question.code.trimEnd(), {
            lang: question.language,
            themes: { light: 'github-light', dark: 'github-dark' },
            defaultColor: false,
          });
          return { ...question, codeHtml };
        }),
      );

      return `export default ${JSON.stringify(compiled)};`;
    },
  };
}
