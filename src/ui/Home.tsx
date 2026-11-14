import { useEffect, useRef, useState } from 'react';
import { computeStats, dailyStreak, failedQuestions } from '../core/history.ts';
import { CHALLENGE_SIZE, countMatching } from '../core/selection.ts';
import { sessionResult } from '../core/session.ts';
import { parseProgress, type LoadStatus } from '../core/storage.ts';
import type {
  Bank,
  ChallengeFilters,
  CurriculumCategory,
  CurriculumFilters,
  Difficulty,
  Progress,
  Session,
  Topic,
} from '../core/types.ts';
import {
  CURRICULUM_CATEGORY_LABELS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  MODE_LABELS,
  TOPICS,
  TOPIC_LABELS,
} from './labels.ts';
import { Icon } from './Icon.tsx';
import { downloadProgress } from './progressFile.ts';
import { SaveFailedNotice } from './QuestionParts.tsx';
import { countCurriculumMatching } from '../core/selection.ts';

const STATUS_NOTICES: Partial<Record<LoadStatus, string>> = {
  corrupt: 'No se ha podido leer el progreso guardado, así que empiezas de cero.',
  newer:
    'El progreso guardado es de una versión más reciente de DevQuiz. Recarga la página: mientras tanto, lo que hagas aquí no se guardará.',
  unavailable: 'Tu navegador no permite guardar datos, así que el progreso se perderá al cerrar la página.',
};

const percent = (accuracy: number | null) => (accuracy === null ? '—' : `${Math.round(accuracy * 100)} %`);

interface HomeProps {
  bank: Bank;
  curriculumBank: Bank;
  progress: Progress;
  active: Session | null;
  status: LoadStatus;
  saveFailed: boolean;
  onStartMixed: () => void;
  onStartFiltered: (filters: ChallengeFilters) => void;
  onStartReview: (filters: ChallengeFilters) => void;
  onStartCurriculum: (filters: CurriculumFilters, failedOnly: boolean) => void;
  onResume: () => void;
  onDiscard: () => void;
  onReset: () => void;
  onImport: (progress: Progress) => void;
}

const IMPORT_ERRORS: Partial<Record<LoadStatus, string>> = {
  corrupt: 'Ese archivo no es una copia válida del progreso de DevQuiz. No se ha cambiado nada.',
  newer: 'Ese archivo es de una versión más reciente de DevQuiz. Recarga la página y vuelve a intentarlo.',
};

export function Home({
  bank,
  curriculumBank,
  progress,
  active,
  status,
  saveFailed,
  onStartMixed,
  onStartFiltered,
  onStartReview,
  onStartCurriculum,
  onResume,
  onDiscard,
  onReset,
  onImport,
}: HomeProps) {
  const [topic, setTopic] = useState<Topic | ''>('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [reviewTopic, setReviewTopic] = useState<Topic | ''>('');
  const [curriculumBlock, setCurriculumBlock] = useState<'' | 1 | 2 | 3>('');
  const [curriculumWeek, setCurriculumWeek] = useState<number | ''>('');
  const [curriculumCategory, setCurriculumCategory] = useState<CurriculumCategory | ''>('');
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [pendingImport, setPendingImport] = useState<Progress | null>(null);
  const [importMessage, setImportMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const [now] = useState(() => Date.now());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const cancelResetRef = useRef<HTMLButtonElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const cancelImportRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (pendingImport) cancelImportRef.current?.focus();
  }, [pendingImport]);

  const focusHeading = () => headingRef.current?.focus();

  const applyImport = (imported: Progress) => {
    onImport(imported);
    setPendingImport(null);
    setImportMessage({ text: 'Progreso importado.', failed: false });
    importButtonRef.current?.focus();
  };

  const readImportFile = async (file: File) => {
    setImportMessage(null);
    const result = parseProgress(await file.text());
    const error = IMPORT_ERRORS[result.status];
    if (error) setImportMessage({ text: error, failed: true });
    else if (progress.sessions.length === 0) applyImport(result.progress);
    else setPendingImport(result.progress);
  };

  const filters: ChallengeFilters = {
    ...(topic ? { topic } : {}),
    ...(difficulty ? { difficulty } : {}),
  };
  const available = countMatching(bank, filters);
  const failed = failedQuestions(progress.sessions, bank);
  const failedCount = failed.length;
  const curriculumFilters: CurriculumFilters = {
    ...(curriculumBlock ? { block: curriculumBlock } : {}),
    ...(curriculumWeek ? { week: curriculumWeek } : {}),
    ...(curriculumCategory ? { category: curriculumCategory } : {}),
  };
  const curriculumMatching = curriculumBank.filter((question) => {
    const metadata = question.curriculum;
    if (!metadata) return false;
    return (
      (!curriculumBlock || Math.ceil(metadata.week / 4) === curriculumBlock) &&
      (!curriculumWeek || metadata.week === curriculumWeek) &&
      (!curriculumCategory || metadata.category === curriculumCategory)
    );
  });
  const curriculumQuestionIds = new Set(curriculumMatching.map((question) => question.id));
  const curriculumFailedCount = failedQuestions(progress.sessions, curriculumBank).filter(({ questionId }) =>
    curriculumQuestionIds.has(questionId),
  ).length;
  const curriculumAvailable = countCurriculumMatching(curriculumBank, curriculumFilters);
  const topicOf = new Map(bank.map((question) => [question.id, question.topic]));
  const failedInTopic = (value: Topic) => failed.filter(({ questionId }) => topicOf.get(questionId) === value).length;
  // El tema elegido puede quedarse sin fallos al repasarlo.
  const reviewFilter = reviewTopic && failedInTopic(reviewTopic) > 0 ? reviewTopic : '';
  const streak = dailyStreak(progress.sessions, now);
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

      <section className="card curriculum-card" aria-labelledby="curriculum-title">
        <h2 id="curriculum-title">Repaso de Reciclaje</h2>
        <p>
          Practica únicamente los tres primeros bloques del plan: semanas 1–12. Este apartado no mezcla sus
          preguntas con los retos generales.
        </p>
        <p className="help">
          El bloque 3 se basa provisionalmente en el resumen del plan; sus preguntas podrán afinarse cuando estén
          preparadas las fichas semanales.
        </p>
        <p className="help">
          Incluye {countCurriculumMatching(curriculumBank, {})}{' '}
          {countCurriculumMatching(curriculumBank, {}) === 1 ? 'pregunta' : 'preguntas'} de código, teoría y
          entrevista técnica.
          Las respuestas y el progreso se guardan en este dispositivo.
        </p>
        <div className="filters curriculum-filters">
          <label>
            Bloque
            <span className="select">
              <select
                value={curriculumBlock}
                onChange={(event) => {
                  setCurriculumBlock(event.target.value ? (Number(event.target.value) as 1 | 2 | 3) : '');
                  setCurriculumWeek('');
                }}
              >
                <option value="">Los tres bloques</option>
                <option value="1">Bloque 1 · Semanas 1–4</option>
                <option value="2">Bloque 2 · Semanas 5–8</option>
                <option value="3">Bloque 3 · Semanas 9–12</option>
              </select>
              <Icon name="chevron" />
            </span>
          </label>
          <label>
            Semana
            <span className="select">
              <select
                value={curriculumWeek}
                onChange={(event) => setCurriculumWeek(event.target.value ? Number(event.target.value) : '')}
              >
                <option value="">Todas las semanas</option>
                {Array.from({ length: 12 }, (_, index) => index + 1)
                  .filter((value) => !curriculumBlock || Math.ceil(value / 4) === curriculumBlock)
                  .map((value) => (
                    <option key={value} value={value}>
                      Semana {value}
                    </option>
                  ))}
              </select>
              <Icon name="chevron" />
            </span>
          </label>
          <label>
            Tipo de pregunta
            <span className="select">
              <select
                value={curriculumCategory}
                onChange={(event) =>
                  setCurriculumCategory(event.target.value as CurriculumCategory | '')
                }
              >
                <option value="">Todos los tipos</option>
                {Object.entries(CURRICULUM_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Icon name="chevron" />
            </span>
          </label>
        </div>
        <p className="help" role="status">
          {curriculumAvailable === 0
            ? 'No hay preguntas con estos filtros.'
            : `${curriculumAvailable} ${curriculumAvailable === 1 ? 'pregunta disponible' : 'preguntas disponibles'}; el reto incluirá hasta 10.`}
        </p>
        <div className="actions">
          <button
            type="button"
            className="button button--primary"
            disabled={curriculumAvailable === 0}
            onClick={() => onStartCurriculum(curriculumFilters, false)}
          >
            Empezar repaso
            <Icon name="arrow" />
          </button>
          <button
            type="button"
            className="button"
            disabled={curriculumFailedCount === 0}
            onClick={() => onStartCurriculum(curriculumFilters, true)}
          >
            Revisar fallos del temario{curriculumFailedCount > 0 ? ` (${curriculumFailedCount})` : ''}
          </button>
        </div>
        {curriculumFailedCount === 0 && (
          <p className="help">No hay preguntas falladas en esta selección todavía.</p>
        )}
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
          {failedCount > 0 && (
            <label className="field">
              Qué repasar
              <span className="select">
                <select value={reviewFilter} onChange={(event) => setReviewTopic(event.target.value as Topic | '')}>
                  <option value="">Todos los fallos ({failedCount})</option>
                  {TOPICS.filter((value) => failedInTopic(value) > 0).map((value) => (
                    <option key={value} value={value}>
                      {TOPIC_LABELS[value]} ({failedInTopic(value)})
                    </option>
                  ))}
                </select>
                <Icon name="chevron" />
              </span>
            </label>
          )}
          <button
            type="button"
            className="button button--wide card-action"
            disabled={failedCount === 0}
            aria-describedby="review-help"
            onClick={() => onStartReview(reviewFilter ? { topic: reviewFilter } : {})}
          >
            Repasar fallos
          </button>
        </section>
      </div>

      <section className="card" aria-labelledby="progress-title">
        <div className="progress-heading">
          <h2 id="progress-title">Tu progreso</h2>
          {streak > 0 && (
            <p className="streak">
              Racha de {streak} {streak === 1 ? 'día' : 'días'}
            </p>
          )}
        </div>
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

        <div className="actions">
          {progress.sessions.length > 0 && (
            <button type="button" className="button" onClick={() => downloadProgress(progress, Date.now())}>
              Exportar progreso
            </button>
          )}
          {status !== 'newer' && (
            <button
              type="button"
              className="button"
              ref={importButtonRef}
              onClick={() => importFileRef.current?.click()}
            >
              Importar progreso
            </button>
          )}
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Archivo de progreso"
            hidden
            ref={importFileRef}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Sin esto, elegir de nuevo el mismo archivo no haría nada.
              event.target.value = '';
              if (file) void readImportFile(file);
            }}
          />
        </div>

        {importMessage && (
          <p className={importMessage.failed ? 'notice' : 'help'} role="alert">
            {importMessage.text}
          </p>
        )}

        {pendingImport && (
          <div className="confirm" role="group" aria-labelledby="import-question">
            <p id="import-question">¿Reemplazar tu progreso por el del archivo? No se puede deshacer.</p>
            <div className="actions">
              <button type="button" className="button button--danger" onClick={() => applyImport(pendingImport)}>
                Sí, reemplazar
              </button>
              <button
                type="button"
                className="button"
                ref={cancelImportRef}
                onClick={() => {
                  setPendingImport(null);
                  importButtonRef.current?.focus();
                }}
              >
                Cancelar importación
              </button>
            </div>
          </div>
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
