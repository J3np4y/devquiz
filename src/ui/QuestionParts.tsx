import type { AppQuestion } from './labels.ts';
import { DIFFICULTY_LABELS, LANGUAGE_LABELS, TOPIC_LABELS } from './labels.ts';

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
  return (
    <figure className="code">
      {/* El HTML lo genera Shiki al compilar a partir del propio banco, no de datos del usuario. */}
      <div dangerouslySetInnerHTML={{ __html: question.codeHtml }} />
      {question.language && (
        <figcaption className="code-caption">
          {LANGUAGE_LABELS[question.language]}
          {question.language === 'sql' && question.verify === 'output' && (
            <>
              . En el resultado, cada línea es una fila y <code>|</code> separa las columnas.
            </>
          )}
        </figcaption>
      )}
    </figure>
  );
}

export function SaveFailedNotice() {
  return (
    <p className="notice" role="alert">
      No se ha podido guardar tu progreso. Puede que el almacenamiento del navegador esté lleno.
    </p>
  );
}

/** Las opciones que son la salida de un programa se muestran como tal. */
export const optionClass = (question: AppQuestion) => (question.verify ? 'option-text mono' : 'option-text');
