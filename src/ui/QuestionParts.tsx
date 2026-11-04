import type { AppQuestion } from './labels.ts';
import { DIFFICULTY_LABELS, TOPIC_LABELS } from './labels.ts';

/** Muestra como código lo que va entre comillas invertidas. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, index) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 1 ? (
          <code key={index}>{part.slice(1, -1)}</code>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function QuestionTags({ question }: { question: AppQuestion }) {
  return (
    <p className="tags">
      <span>{TOPIC_LABELS[question.topic]}</span>
      <span>{DIFFICULTY_LABELS[question.difficulty]}</span>
    </p>
  );
}

export function CodeBlock({ question }: { question: AppQuestion }) {
  if (!question.codeHtml) return null;
  // El HTML lo genera Shiki al compilar a partir del propio banco, no de datos del usuario.
  return <div className="code" dangerouslySetInnerHTML={{ __html: question.codeHtml }} />;
}

/** Las opciones que son la salida de un programa se muestran como tal. */
export const optionClass = (question: AppQuestion) => (question.verify ? 'option-text mono' : 'option-text');
