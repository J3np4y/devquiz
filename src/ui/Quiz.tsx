import { useEffect, useRef } from 'react';
import type { Session } from '../core/types.ts';
import { MODE_LABELS, type AppQuestion } from './labels.ts';
import { CodeBlock, QuestionTags, RichText, optionClass } from './QuestionParts.tsx';

interface QuizProps {
  session: Session;
  question: AppQuestion;
  onAnswer: (optionId: string) => void;
  onNext: () => void;
  onExit: () => void;
}

export function Quiz({ session, question, onAnswer, onNext, onExit }: QuizProps) {
  const item = session.questions[session.currentIndex];
  const answer = item?.answer;
  const position = session.currentIndex + 1;
  const total = session.questions.length;
  const isLast = position === total;

  const options = (item?.optionOrder ?? []).flatMap((id) => {
    const option = question.options.find((candidate) => candidate.id === id);
    return option ? [option] : [];
  });

  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Lleva el foco a la pregunta nueva, y al botón de avanzar tras responder.
  useEffect(() => {
    headingRef.current?.focus();
  }, [session.currentIndex]);

  useEffect(() => {
    if (answer) nextRef.current?.focus();
  }, [answer]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;

      if (!answer && /^[1-4]$/.test(event.key)) {
        const option = options[Number(event.key) - 1];
        if (option) onAnswer(option.id);
      } else if (answer && event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
        onNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <main className="page">
      <header className="quiz-header">
        <p className="quiz-progress">
          <span className="mono">
            {MODE_LABELS[session.mode]} · Pregunta {position} de {total}
          </span>
          <progress value={position} max={total} aria-hidden="true" />
        </p>
        <button type="button" className="button button--quiet" onClick={onExit}>
          Salir
        </button>
      </header>

      <QuestionTags question={question} />
      <h1 className="prompt" tabIndex={-1} ref={headingRef}>
        <RichText text={question.prompt} />
      </h1>
      <CodeBlock question={question} />

      <ol className="options">
        {options.map((option, index) => {
          const chosen = answer?.optionId === option.id;
          const correct = question.correct === option.id;
          const state = !answer ? '' : correct ? 'option--correct' : chosen ? 'option--wrong' : 'option--muted';

          return (
            <li key={option.id}>
              <button
                type="button"
                className={`option ${state}`}
                disabled={Boolean(answer)}
                onClick={() => onAnswer(option.id)}
              >
                <span className="option-key mono" aria-hidden="true">
                  {index + 1}
                </span>
                <span className={optionClass(question)}>
                  <RichText text={option.text} />
                </span>
                {answer && correct && <span className="option-mark">✓ Correcta</span>}
                {answer && chosen && !correct && <span className="option-mark">✗ Tu respuesta</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {!answer && (
        <p className="help keyboard-hint">
          Pulsa de 1 a {Math.min(options.length, 4)} para responder.
        </p>
      )}

      <div role="status" className="feedback-region">
        {answer && (
          <div className={`feedback ${answer.correct ? 'feedback--correct' : 'feedback--wrong'}`}>
            <p className="feedback-title">{answer.correct ? '✓ ¡Correcto!' : '✗ Incorrecto'}</p>
            <p>
              <RichText text={question.explanation} />
            </p>
          </div>
        )}
      </div>

      {answer && (
        <button
          type="button"
          ref={nextRef}
          className="button button--primary button--wide"
          onKeyDown={(event) => {
            // Mantener Enter pulsado no debe saltarse preguntas.
            if (event.repeat) event.preventDefault();
          }}
          onClick={onNext}
        >
          {isLast ? 'Ver resultados' : 'Siguiente pregunta'}
        </button>
      )}
    </main>
  );
}
