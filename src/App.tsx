import { useEffect, useMemo } from 'react';
import { failedQuestions } from './core/history.ts';
import { selectFiltered, selectMixed, selectReview } from './core/selection.ts';
import {
  activeSession,
  advance,
  answerCurrent,
  createSession,
  currentQuestion,
  discardActive,
  startSession,
} from './core/session.ts';
import type { StorageLike } from './core/storage.ts';
import type { ChallengeFilters, ChallengeMode, Question } from './core/types.ts';
import { Home } from './ui/Home.tsx';
import type { AppQuestion } from './ui/labels.ts';
import { Quiz } from './ui/Quiz.tsx';
import { Results } from './ui/Results.tsx';
import { CHALLENGE, HOME, navigate, resultsHash, useHashRoute } from './ui/useHashRoute.ts';
import { useProgress } from './ui/useProgress.ts';

interface AppProps {
  bank: readonly AppQuestion[];
  storage: StorageLike | null;
}

export function App({ bank, storage }: AppProps) {
  const route = useHashRoute();
  const { progress, status, saveFailed, update, reset } = useProgress(bank, storage);
  const questionsById = useMemo(() => new Map(bank.map((question) => [question.id, question])), [bank]);

  const active = activeSession(progress);
  const activeItem = active && currentQuestion(active);
  const activeQuestion = activeItem ? questionsById.get(activeItem.questionId) : undefined;
  const finished =
    route.name === 'results' ? progress.sessions.find((session) => session.id === route.sessionId) : undefined;

  const inChallenge = route.name === 'challenge' && active && activeQuestion;
  const inResults = route.name === 'results' && finished;

  // Una ruta sin contenido, como un reto ya terminado al volver atrás, lleva al inicio.
  useEffect(() => {
    if (route.name !== 'home' && !inChallenge && !inResults) navigate(HOME);
  }, [route.name, inChallenge, inResults]);

  const title = inChallenge
    ? `Pregunta ${active.currentIndex + 1} de ${active.questions.length} · DevQuiz`
    : inResults
      ? 'Resultados · DevQuiz'
      : 'DevQuiz';

  useEffect(() => {
    document.title = title;
  }, [title]);

  const start = (mode: ChallengeMode, questions: readonly Question[], filters?: ChallengeFilters) => {
    const now = Date.now();
    const session = createSession({
      mode,
      questions,
      now,
      rng: Math.random,
      ...(filters ? { filters } : {}),
    });
    if (!session) return;
    update((current) => startSession(current, session, now));
    navigate(CHALLENGE);
  };

  const startReview = () => start('review', selectReview(bank, progress.sessions));

  if (inChallenge) {
    return (
      <Quiz
        // Cada pregunta es una pantalla nueva: evita arrastrar su estado a la siguiente.
        key={`${active.id}-${active.currentIndex}`}
        session={active}
        question={activeQuestion}
        onAnswer={(optionId) => update((current) => answerCurrent(current, activeQuestion, optionId, Date.now()))}
        onNext={() => {
          const isLast = active.currentIndex >= active.questions.length - 1;
          update((current) => advance(current, Date.now()));
          if (isLast) navigate(resultsHash(active.id));
        }}
        onExit={() => navigate(HOME)}
      />
    );
  }

  if (inResults) {
    return (
      <Results
        key={finished.id}
        session={finished}
        questionsById={questionsById}
        failedCount={failedQuestions(progress.sessions, bank).length}
        onReview={startReview}
        onHome={() => navigate(HOME)}
      />
    );
  }

  return (
    <Home
      bank={bank}
      progress={progress}
      active={active}
      status={status}
      saveFailed={saveFailed}
      onStartMixed={() => start('mixed', selectMixed(bank, progress.sessions, Math.random))}
      onStartFiltered={(filters) =>
        start('filtered', selectFiltered(bank, filters, progress.sessions, Math.random), filters)
      }
      onStartReview={startReview}
      onResume={() => navigate(CHALLENGE)}
      onDiscard={() => update((current) => discardActive(current, Date.now()))}
      onReset={reset}
    />
  );
}
