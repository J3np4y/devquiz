import { useEffect, useRef } from 'react';
import type { Session } from '../core/types.ts';
import { Icon } from './Icon.tsx';
import { MODE_LABELS, type AppQuestion } from './labels.ts';
import { CodeBlock, QuestionTags, ReportLink, RichText, SaveFailedNotice, optionClass } from './QuestionParts.tsx';

interface QuizProps {
  session: Session;
  question: AppQuestion;
  saveFailed: boolean;
  shortcutsEnabled: boolean;
  onToggleShortcuts: (enabled: boolean) => void;
  onAnswer: (optionId: string) => void;
  onNext: () => void;
  onExit: () => void;
}

export function Quiz({
  session,
  question,
  saveFailed,
  shortcutsEnabled,
  onToggleShortcuts,
  onAnswer,
  onNext,
  onExit,
}: QuizProps) {
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

      if (!answer && shortcutsEnabled && /^[1-4]$/.test(event.key)) {
        const option = options[Number(event.key) - 1];
        if (option) onAnswer(option.id);
      } else if (answer && event.key === 'Enter' && !(event.target instanceof Element && event.target.closest('a, button'))) {
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
          <span className="segments" aria-hidden="true">
            {session.questions.map((entry, index) => (
              <span
                key={entry.questionId}
                className={
                  entry.answer
                    ? `segment segment--${entry.answer.correct ? 'correct' : 'wrong'}`
                    : index === session.currentIndex
                      ? 'segment segment--current'
                      : 'segment'
                }
              />
            ))}
          </span>
        </p>
        <button type="button" className="button button--quiet" onClick={onExit}>
          Salir
        </button>
      </header>

      {saveFailed && <SaveFailedNotice />}

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
                {answer && correct && (
                  <span className="option-mark">
                    <Icon name="check" />
                    Correcta
                  </span>
                )}
                {answer && chosen && !correct && (
                  <span className="option-mark">
                    <Icon name="cross" />
                    Tu respuesta
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {!answer && (
        // Los atajos de una sola tecla deben poder desactivarse (WCAG 2.1.4).
        <p className="help keyboard-hint">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={shortcutsEnabled}
              onChange={(event) => onToggleShortcuts(event.target.checked)}
            />
            Responder con las teclas de 1 a {Math.min(options.length, 4)}
          </label>
        </p>
      )}

      <div role="status" className="feedback-region">
        {answer && (
          <div className={`feedback ${answer.correct ? 'feedback--correct' : 'feedback--wrong'}`}>
            <p className="feedback-title">
              <Icon name={answer.correct ? 'check' : 'cross'} />
              {answer.correct ? '¡Correcto!' : 'Incorrecto'}
            </p>
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
          <Icon name="arrow" />
        </button>
      )}

      {answer && <ReportLink question={question} />}
    </main>
  );
}
