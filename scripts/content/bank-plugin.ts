import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { codeToHtml } from 'shiki';
import type { Plugin } from 'vite';
import { loadBank } from './load.ts';

const VIRTUAL_ID = 'virtual:bank';

interface BankPluginOptions {
  directory?: string;
  virtualId?: string;
}

/**
 * Expone el banco como `virtual:bank`. Valida las preguntas y resalta el código al compilar,
 * de modo que ni el validador ni el resaltador llegan al navegador.
 */
export function bankPlugin({ directory: directoryName = 'questions', virtualId = VIRTUAL_ID }: BankPluginOptions = {}): Plugin {
  let directory = '';
  const resolvedId = `\0${virtualId}`;

  return {
    name: `devquiz-bank-${directoryName}`,
    configResolved(config) {
      directory = join(config.root, 'content', directoryName);
    },
    resolveId(id) {
      return id === virtualId ? resolvedId : undefined;
    },
    async load(id) {
      if (id !== resolvedId) return undefined;

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
            // La variante clara normal no alcanza el contraste AA sobre el fondo del bloque.
            themes: { light: 'github-light-high-contrast', dark: 'github-dark' },
            defaultColor: false,
          });
          return { ...question, codeHtml };
        }),
      );

      return `export default ${JSON.stringify(compiled)};`;
    },
  };
}
