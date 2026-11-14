import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkCoverage, checkCurriculumCoverage, coverageTable } from './content/coverage.ts';
import { loadBank } from './content/load.ts';
import { PYTHON, verifyQuestion } from './content/verify.ts';

const MIN_PER_COMBINATION = 7;
const QUESTIONS_DIR = fileURLToPath(new URL('../content/questions/', import.meta.url));
const CURRICULUM_DIR = fileURLToPath(new URL('../content/reciclaje/', import.meta.url));

const { questions, errors } = loadBank(QUESTIONS_DIR);
const curriculum = loadBank(CURRICULUM_DIR);
errors.push(...curriculum.errors);

errors.push(...checkCoverage(questions, MIN_PER_COMBINATION));
errors.push(...checkCurriculumCoverage(curriculum.questions));

const allQuestions = [...questions, ...curriculum.questions];
const toVerify = allQuestions.filter((question) => question.verify);
for (const question of toVerify) {
  const failure = verifyQuestion(question);
  if (failure) errors.push(`${question.topic} > ${question.id}: ${failure}`);
}

const python = spawnSync(PYTHON, ['--version'], { encoding: 'utf8' }).stdout.trim();
console.log(`Versiones: Node ${process.version}, ${python || 'Python no disponible'}`);
console.log(`${questions.length} preguntas, ${toVerify.length} verificadas ejecutando código\n`);
console.log(coverageTable(questions));
console.log(`\nReciclaje: ${curriculum.questions.length} preguntas para las semanas 1–12`);

if (errors.length > 0) {
  console.error(`\n${errors.length} errores:`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('\nBanco de preguntas correcto.');
