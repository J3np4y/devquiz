import { useEffect, useMemo, useState } from 'react';
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
import {
  loadShortcutsEnabled,
  requestPersistentStorage,
  saveShortcutsEnabled,
  type StorageLike,
} from './core/storage.ts';
import type { ChallengeMode, Question } from './core/types.ts';
import { Home } from './ui/Home.tsx';
import type { AppQuestion } from './ui/labels.ts';
import { Quiz } from './ui/Quiz.tsx';
import { Results } from './ui/Results.tsx';
import { useClickGuard } from './ui/useClickGuard.ts';
import { CHALLENGE, HOME, navigate, replaceRoute, resultsHash, useHashRoute } from './ui/useHashRoute.ts';
import { useProgress } from './ui/useProgress.ts';

interface AppProps {
  bank: readonly AppQuestion[];
  storage: StorageLike | null;
}

export function App({ bank, storage }: AppProps) {
  const route = useHashRoute();
  const { progress, status, saveFailed, update, reset } = useProgress(bank, storage);
  const [shortcutsEnabled, setShortcutsEnabled] = useState(() => loadShortcutsEnabled(storage));
  const questionsById = useMemo(() => new Map(bank.map((question) => [question.id, question])), [bank]);

  const active = activeSession(progress);
  const activeItem = active && currentQuestion(active);
  const activeQuestion = activeItem ? questionsById.get(activeItem.questionId) : undefined;
  // Solo un reto terminado tiene resultados: en otro, lo no respondido parecería un fallo.
  const finished =
    route.name === 'results'
      ? progress.sessions.find((session) => session.id === route.sessionId && session.status === 'completed')
      : undefined;

  const inChallenge = route.name === 'challenge' && active && activeQuestion;
  const inResults = route.name === 'results' && finished;

  // Una ruta sin contenido, como un reto ya terminado al volver atrás, lleva al inicio.
  useEffect(() => {
    if (route.name !== 'home' && !inChallenge && !inResults) replaceRoute(HOME);
  }, [route.name, inChallenge, inResults]);

  const title = inChallenge
    ? `Pregunta ${active.currentIndex + 1} de ${active.questions.length} · DevQuiz`
    : inResults
      ? 'Resultados · DevQuiz'
      : 'DevQuiz';

  useEffect(() => {
    document.title = title;
  }, [title]);

  useClickGuard(
    inChallenge ? `reto-${active.id}-${active.currentIndex}` : inResults ? `resultado-${finished.id}` : 'inicio',
  );

  const start = (mode: ChallengeMode, questions: readonly Question[]) => {
    const now = Date.now();
    const session = createSession({ mode, questions, now, rng: Math.random });
    if (!session) return;
    // Algunos navegadores lo preguntan al usuario, así que solo se pide con el primer reto.
    if (progress.sessions.length === 0) void requestPersistentStorage();
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
        saveFailed={saveFailed}
        shortcutsEnabled={shortcutsEnabled}
        onToggleShortcuts={(enabled) => {
          setShortcutsEnabled(enabled);
          saveShortcutsEnabled(storage, enabled);
        }}
        onAnswer={(optionId) => update((current) => answerCurrent(current, activeQuestion, optionId, Date.now()))}
        onNext={() => {
          const isLast = active.currentIndex >= active.questions.length - 1;
          update((current) => advance(current, Date.now()));
          if (isLast) replaceRoute(resultsHash(active.id));
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
        saveFailed={saveFailed}
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
      onStartFiltered={(filters) => start('filtered', selectFiltered(bank, filters, progress.sessions, Math.random))}
      onStartReview={startReview}
      onResume={() => navigate(CHALLENGE)}
      onDiscard={() => update((current) => discardActive(current, Date.now()))}
      onReset={reset}
    />
  );
}
