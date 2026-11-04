import { useEffect, useRef } from 'react';
import { sessionResult } from '../core/session.ts';
import type { Session } from '../core/types.ts';
import { MODE_LABELS, type AppQuestion } from './labels.ts';
import { CodeBlock, QuestionTags, RichText, SaveFailedNotice, optionClass } from './QuestionParts.tsx';

interface ResultsProps {
  session: Session;
  questionsById: ReadonlyMap<string, AppQuestion>;
  failedCount: number;
  saveFailed: boolean;
  onReview: () => void;
  onHome: () => void;
}

export function Results({ session, questionsById, failedCount, saveFailed, onReview, onHome }: ResultsProps) {
  const { total, correct } = sessionResult(session);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="page">
      <header className="masthead">
        <p className="mono eyebrow">{MODE_LABELS[session.mode]}</p>
        <h1 tabIndex={-1} ref={headingRef}>
          Has acertado {correct} de {total}
        </h1>
      </header>

      {saveFailed && <SaveFailedNotice />}

      <div className="actions">
        {failedCount > 0 && (
          <button type="button" className="button button--primary" onClick={onReview}>
            Repasar fallos ({failedCount})
          </button>
        )}
        <button type="button" className="button" onClick={onHome}>
          Volver al inicio
        </button>
      </div>

      <h2 className="section-title">Revisa tus respuestas</h2>
      <ol className="review">
        {session.questions.flatMap((item) => {
          const question = questionsById.get(item.questionId);
          if (!question) return [];

          const chosen = question.options.find((option) => option.id === item.answer?.optionId);
          const right = question.options.find((option) => option.id === question.correct);
          const isCorrect = item.answer?.correct ?? false;

          return [
            <li key={item.questionId} className={`card review-item ${isCorrect ? 'review-item--correct' : 'review-item--wrong'}`}>
              <p className="review-result">{isCorrect ? '✓ Correcta' : '✗ Incorrecta'}</p>
              <QuestionTags question={question} />
              <h3>
                <RichText text={question.prompt} />
              </h3>
              <CodeBlock question={question} />
              <dl className="review-answers">
                {!isCorrect && (
                  <div>
                    <dt>Tu respuesta</dt>
                    <dd className={optionClass(question)}>
                      {chosen ? <RichText text={chosen.text} /> : 'Esta opción ya no existe'}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>{isCorrect ? 'Tu respuesta, correcta' : 'Respuesta correcta'}</dt>
                  <dd className={optionClass(question)}>{right && <RichText text={right.text} />}</dd>
                </div>
              </dl>
              <p>
                <RichText text={question.explanation} />
              </p>
            </li>,
          ];
        })}
      </ol>

      <button type="button" className="button button--wide" onClick={onHome}>
        Volver al inicio
      </button>
    </main>
  );
}
