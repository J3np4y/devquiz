import { DIFFICULTIES, TOPICS, type Question, type Topic } from './schema.ts';

/** Temas en los que el código encaja de forma natural. */
const CODE_TOPICS: readonly Topic[] = ['javascript', 'python', 'sql', 'fundamentos', 'testing'];
const MIN_CODE_RATIO = 0.4;

export function checkCoverage(questions: Question[], minPerCombination: number): string[] {
  const errors: string[] = [];

  for (const topic of TOPICS) {
    const inTopic = questions.filter((question) => question.topic === topic);

    for (const difficulty of DIFFICULTIES) {
      const count = inTopic.filter((question) => question.difficulty === difficulty).length;
      if (count < minPerCombination) {
        errors.push(`${topic} / ${difficulty}: ${count} preguntas, mínimo ${minPerCombination}`);
      }
    }

    if (CODE_TOPICS.includes(topic) && inTopic.length > 0) {
      const ratio = inTopic.filter((question) => question.type === 'code').length / inTopic.length;
      if (ratio < MIN_CODE_RATIO) {
        errors.push(`${topic}: ${Math.round(ratio * 100)} % con código, mínimo ${MIN_CODE_RATIO * 100} %`);
      }
    }
  }

  return errors;
}

export function coverageTable(questions: Question[]): string {
  const rows = TOPICS.map((topic) => {
    const inTopic = questions.filter((question) => question.topic === topic);
    const counts = DIFFICULTIES.map(
      (difficulty) => inTopic.filter((question) => question.difficulty === difficulty).length,
    );
    const code = inTopic.filter((question) => question.type === 'code').length;
    return `${topic.padEnd(14)}${counts.map((count) => String(count).padStart(6)).join('')}${String(code).padStart(8)}`;
  });

  const header = `${''.padEnd(14)}${['princ', 'inter', 'avanz'].map((label) => label.padStart(6)).join('')}${'código'.padStart(8)}`;
  return [header, ...rows].join('\n');
}
