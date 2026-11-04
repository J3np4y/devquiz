import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Language, Question } from './schema.ts';

const RUN_SQL = fileURLToPath(new URL('./run_sql.py', import.meta.url));
const TIMEOUT_MS = 10_000;
export const PYTHON = process.env.PYTHON ?? 'python';

/** Se usa .cjs para que los fragmentos de JavaScript se ejecuten como script, no como módulo. */
const RUNNERS: Record<Language, { file: string; command: (path: string) => [string, string[]] }> = {
  javascript: { file: 'snippet.cjs', command: (path) => [process.execPath, [path]] },
  python: { file: 'snippet.py', command: (path) => [PYTHON, ['-I', path]] },
  sql: { file: 'snippet.sql', command: (path) => [PYTHON, ['-I', RUN_SQL, path]] },
};

export interface RunResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

export function runSnippet(language: Language, code: string): RunResult {
  const runner = RUNNERS[language];
  const directory = mkdtempSync(join(tmpdir(), 'devquiz-'));

  try {
    const path = join(directory, runner.file);
    writeFileSync(path, code);
    const [command, args] = runner.command(path);
    const result = spawnSync(command, args, {
      cwd: directory,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    if (result.error) {
      return { stdout: '', stderr: result.error.message, status: null };
    }
    return { stdout: result.stdout, stderr: result.stderr, status: result.status };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const normalize = (text: string) => text.replace(/\r\n/g, '\n').trim();

/** Devuelve el motivo del fallo, o null si el resultado confirma la respuesta correcta. */
export function verifyQuestion(question: Question): string | null {
  if (!question.verify || !question.code || !question.language) return null;

  const correctText = question.options.find((option) => option.id === question.correct)?.text ?? '';
  const result = runSnippet(question.language, question.code);

  if (question.verify === 'output') {
    if (result.status !== 0) {
      return `el fragmento falló (estado ${result.status}): ${normalize(result.stderr)}`;
    }
    const actual = normalize(result.stdout);
    return actual === normalize(correctText)
      ? null
      : `la salida es ${JSON.stringify(actual)}, pero la respuesta marcada es ${JSON.stringify(correctText)}`;
  }

  if (result.status === 0) {
    return `se esperaba un error "${correctText}", pero el fragmento terminó bien`;
  }
  return result.stderr.includes(correctText.trim())
    ? null
    : `se esperaba un error "${correctText}", pero se obtuvo: ${normalize(result.stderr)}`;
}
