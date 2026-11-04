import { useEffect, useRef, useState } from 'react';
import { computeStats, failedQuestions } from '../core/history.ts';
import { CHALLENGE_SIZE, countMatching } from '../core/selection.ts';
import { sessionResult } from '../core/session.ts';
import type { LoadStatus } from '../core/storage.ts';
import type { Bank, ChallengeFilters, Difficulty, Progress, Session, Topic } from '../core/types.ts';
import { DIFFICULTIES, DIFFICULTY_LABELS, MODE_LABELS, TOPICS, TOPIC_LABELS } from './labels.ts';
import { Icon } from './Icon.tsx';
import { SaveFailedNotice } from './QuestionParts.tsx';

const STATUS_NOTICES: Partial<Record<LoadStatus, string>> = {
  corrupt: 'No se ha podido leer el progreso guardado, así que empiezas de cero.',
  newer:
    'El progreso guardado es de una versión más reciente de DevQuiz. Recarga la página: mientras tanto, lo que hagas aquí no se guardará.',
  unavailable: 'Tu navegador no permite guardar datos, así que el progreso se perderá al cerrar la página.',
};

const percent = (accuracy: number | null) => (accuracy === null ? '—' : `${Math.round(accuracy * 100)} %`);

interface HomeProps {
  bank: Bank;
  progress: Progress;
  active: Session | null;
  status: LoadStatus;
  saveFailed: boolean;
  onStartMixed: () => void;
  onStartFiltered: (filters: ChallengeFilters) => void;
  onStartReview: () => void;
  onResume: () => void;
  onDiscard: () => void;
  onReset: () => void;
}

export function Home({
  bank,
  progress,
  active,
  status,
  saveFailed,
  onStartMixed,
  onStartFiltered,
  onStartReview,
  onResume,
  onDiscard,
  onReset,
}: HomeProps) {
  const [topic, setTopic] = useState<Topic | ''>('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [confirmingReset, setConfirmingReset] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const cancelResetRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingReset = useRef(confirmingReset);

  // Al llegar desde otra pantalla, el foco y el scroll empiezan arriba.
  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo(0, 0);
  }, []);

  // El botón pulsado desaparece al confirmar o cancelar, así que el foco debe ir a otro sitio.
  useEffect(() => {
    if (wasConfirmingReset.current === confirmingReset) return;
    wasConfirmingReset.current = confirmingReset;
    (confirmingReset ? cancelResetRef : resetButtonRef).current?.focus();
  }, [confirmingReset]);

  const focusHeading = () => headingRef.current?.focus();

  const filters: ChallengeFilters = {
    ...(topic ? { topic } : {}),
    ...(difficulty ? { difficulty } : {}),
  };
  const available = countMatching(bank, filters);
  const failedCount = failedQuestions(progress.sessions, bank).length;
  const stats = computeStats(progress.sessions, bank);
  const notice = STATUS_NOTICES[status];
  const activeResult = active ? sessionResult(active) : null;

  return (
    <main className="page page--wide">
      <header className="brand">
        <span className="brand-mark">
          <Icon name="code" />
        </span>
        <div>
          <h1 tabIndex={-1} ref={headingRef}>
            DevQuiz
          </h1>
          <p>Repasa conocimientos de desarrollo en sesiones breves.</p>
        </div>
      </header>

      {notice && <p className="notice" role="alert">{notice}</p>}
      {saveFailed && <SaveFailedNotice />}

      {active && activeResult && (
        <section className="card card--accent" aria-labelledby="resume-title">
          <h2 id="resume-title">Tienes un reto en curso</h2>
          <p>
            {MODE_LABELS[active.mode]}: {activeResult.answered} de {activeResult.total} preguntas respondidas.
            Si empiezas otro, este se descartará, pero tus respuestas se conservan.
          </p>
          <div className="actions">
            <button type="button" className="button button--primary" onClick={onResume}>
              Reanudar
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                onDiscard();
                focusHeading();
              }}
            >
              Descartar
            </button>
          </div>
        </section>
      )}

      <section className="hero" aria-labelledby="quick-title">
        <Icon name="code" className="hero-glyph" />
        <h2 id="quick-title">Reto rápido</h2>
        <p>{CHALLENGE_SIZE} preguntas variadas, de distintos temas y niveles.</p>
        <button type="button" className="button button--hero" onClick={onStartMixed}>
          Empezar reto rápido
          <Icon name="arrow" />
        </button>
      </section>

      <div className="home-grid">
        <section className="card" aria-labelledby="custom-title">
          <h2 id="custom-title">Reto a medida</h2>
          <form
            className="filters"
            onSubmit={(event) => {
              event.preventDefault();
              if (available > 0) onStartFiltered(filters);
            }}
          >
            <label>
              Tema
              <span className="select">
                <select value={topic} onChange={(event) => setTopic(event.target.value as Topic | '')}>
                  <option value="">Todos los temas</option>
                  {TOPICS.map((value) => (
                    <option key={value} value={value}>
                      {TOPIC_LABELS[value]}
                    </option>
                  ))}
                </select>
                <Icon name="chevron" />
              </span>
            </label>
            <label>
              Nivel
              <span className="select">
                <select
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value as Difficulty | '')}
                >
                  <option value="">Todos los niveles</option>
                  {DIFFICULTIES.map((value) => (
                    <option key={value} value={value}>
                      {DIFFICULTY_LABELS[value]}
                    </option>
                  ))}
                </select>
                <Icon name="chevron" />
              </span>
            </label>
            <p id="filter-help" className="help" role="status">
              {available === 0 && 'No hay preguntas con este filtro. Prueba con otro.'}
              {available > 0 && available < CHALLENGE_SIZE &&
                `Solo hay ${available} ${available === 1 ? 'pregunta' : 'preguntas'} con este filtro, así que el reto será más corto.`}
              {available >= CHALLENGE_SIZE && `El reto tendrá ${CHALLENGE_SIZE} preguntas.`}
            </p>
            <button
              type="submit"
              className="button button--wide"
              disabled={available === 0}
              aria-describedby="filter-help"
            >
              Empezar reto a medida
            </button>
          </form>
        </section>

        <section className="card" aria-labelledby="review-title">
          <h2 id="review-title">Repaso de fallos</h2>
          <p id="review-help">
            {failedCount === 0
              ? 'Aún no tienes preguntas falladas. Aparecerán aquí cuando falles alguna.'
              : `Tienes ${failedCount} ${failedCount === 1 ? 'pregunta fallada' : 'preguntas falladas'}. Cada una sale de la lista al acertarla.`}
          </p>
          <button
            type="button"
            className="button button--wide card-action"
            disabled={failedCount === 0}
            aria-describedby="review-help"
            onClick={onStartReview}
          >
            Repasar fallos
          </button>
        </section>
      </div>

      <section className="card" aria-labelledby="progress-title">
        <h2 id="progress-title">Tu progreso</h2>
        <dl className="stats">
          <div>
            <dt>Respondidas</dt>
            <dd>{stats.answered}</dd>
          </div>
          <div>
            <dt>Precisión</dt>
            <dd>{percent(stats.accuracy)}</dd>
          </div>
          <div>
            <dt>Retos completados</dt>
            <dd>{stats.completed}</dd>
          </div>
        </dl>

        {stats.answered > 0 && (
          <table className="topic-table">
            <caption>Precisión por tema</caption>
            <thead>
              <tr>
                <th scope="col">Tema</th>
                <th scope="col">Respondidas</th>
                <th scope="col">Precisión</th>
              </tr>
            </thead>
            <tbody>
              {TOPICS.flatMap((value) => {
                const row = stats.byTopic[value];
                return row
                  ? [
                      <tr key={value}>
                        <th scope="row">{TOPIC_LABELS[value]}</th>
                        <td>{row.answered}</td>
                        <td>
                          <span className="meter-cell">
                            <span className="meter" aria-hidden="true">
                              <span className="meter-fill" style={{ width: `${(row.accuracy ?? 0) * 100}%` }} />
                            </span>
                            <span className="meter-value">{percent(row.accuracy)}</span>
                          </span>
                        </td>
                      </tr>,
                    ]
                  : [];
              })}
            </tbody>
          </table>
        )}

        {progress.sessions.length > 0 &&
          (confirmingReset ? (
            <div className="confirm" role="group" aria-labelledby="reset-question">
              <p id="reset-question">¿Borrar todo tu progreso? No se puede deshacer.</p>
              <div className="actions">
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => {
                    onReset();
                    setConfirmingReset(false);
                    focusHeading();
                  }}
                >
                  Sí, borrar todo
                </button>
                <button
                  type="button"
                  className="button"
                  ref={cancelResetRef}
                  onClick={() => setConfirmingReset(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="button button--quiet"
              ref={resetButtonRef}
              onClick={() => setConfirmingReset(true)}
            >
              Reiniciar progreso
            </button>
          ))}
      </section>

      <footer className="footer">
        <p>Sin cuentas ni seguimiento: tu progreso solo se guarda en este dispositivo.</p>
      </footer>
    </main>
  );
}
