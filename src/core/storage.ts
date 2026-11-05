import { SCHEMA_VERSION, emptyProgress, type Progress } from './types.ts';

export const STORAGE_KEY = 'devquiz.progress';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const SHORTCUTS_KEY = 'devquiz.shortcuts';

/** Preferencia del dispositivo, ajena al progreso: reiniciar el progreso no la borra. */
export function loadShortcutsEnabled(storage: StorageLike | null): boolean {
  try {
    return storage?.getItem(SHORTCUTS_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveShortcutsEnabled(storage: StorageLike | null, enabled: boolean): void {
  try {
    storage?.setItem(SHORTCUTS_KEY, enabled ? 'on' : 'off');
  } catch {
    // Sin almacenamiento, la preferencia solo dura hasta recargar.
  }
}

/**
 * - `ok`: datos cargados, o ninguno todavía.
 * - `corrupt`: datos ilegibles; se empieza de cero y se sobrescribirán.
 * - `newer`: datos de una versión posterior de la app; no se tocan.
 * - `unavailable`: el navegador no permite guardar.
 */
export type LoadStatus = 'ok' | 'corrupt' | 'newer' | 'unavailable';

export interface LoadResult {
  progress: Progress;
  status: LoadStatus;
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Cada entrada convierte los datos de la versión indicada a la siguiente. */
const MIGRATIONS: Record<number, Migration> = {};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isAnswer = (value: unknown) =>
  isRecord(value) &&
  typeof value.optionId === 'string' &&
  typeof value.correct === 'boolean' &&
  typeof value.at === 'number';

const isSessionQuestion = (value: unknown) =>
  isRecord(value) &&
  typeof value.questionId === 'string' &&
  isStringArray(value.optionOrder) &&
  (value.answer === undefined || isAnswer(value.answer));

const isSession = (value: unknown) =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  ['mixed', 'filtered', 'review'].includes(value.mode as string) &&
  ['active', 'completed', 'abandoned'].includes(value.status as string) &&
  typeof value.startedAt === 'number' &&
  typeof value.currentIndex === 'number' &&
  Array.isArray(value.questions) &&
  value.questions.every(isSessionQuestion);

const isProgress = (value: Record<string, unknown>) =>
  value.schemaVersion === SCHEMA_VERSION &&
  Array.isArray(value.sessions) &&
  value.sessions.every(isSession);

export function migrate(
  data: Record<string, unknown>,
  migrations: Record<number, Migration> = MIGRATIONS,
  target: number = SCHEMA_VERSION,
): Record<string, unknown> | null {
  let current = data;
  while (typeof current.schemaVersion === 'number' && current.schemaVersion < target) {
    const step = migrations[current.schemaVersion];
    if (!step) return null;
    current = step(current);
  }
  return current;
}

export function loadProgress(storage: StorageLike | null): LoadResult {
  if (!storage) return { progress: emptyProgress(), status: 'unavailable' };

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { progress: emptyProgress(), status: 'unavailable' };
  }
  return raw === null ? { progress: emptyProgress(), status: 'ok' } : parseProgress(raw);
}

/** Interpreta el progreso guardado o exportado. Los datos antiguos se migran. */
export function parseProgress(raw: string): LoadResult {
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) return { progress: emptyProgress(), status: 'corrupt' };

    if (typeof data.schemaVersion === 'number' && data.schemaVersion > SCHEMA_VERSION) {
      return { progress: emptyProgress(), status: 'newer' };
    }

    const migrated = migrate(data);
    return migrated && isProgress(migrated)
      ? { progress: migrated as unknown as Progress, status: 'ok' }
      : { progress: emptyProgress(), status: 'corrupt' };
  } catch {
    return { progress: emptyProgress(), status: 'corrupt' };
  }
}

/** Datos de una versión posterior no se sobrescriben: una caché antigua no debe borrarlos. */
export const canSave = (status: LoadStatus) => status === 'ok' || status === 'corrupt';

/** Devuelve false si no se ha podido guardar, por ejemplo por falta de espacio. */
export function saveProgress(storage: StorageLike | null, progress: Progress): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function clearProgress(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pide al navegador que no borre los datos si le falta espacio. Algunos navegadores lo preguntan
 * al usuario, así que se hace al empezar un reto y no al abrir la app. Nunca lanza un error.
 */
export async function requestPersistentStorage(
  storageManager: Pick<StorageManager, 'persist' | 'persisted'> | undefined = globalThis.navigator?.storage,
): Promise<boolean> {
  try {
    if (!storageManager?.persist) return false;
    return (await storageManager.persisted()) || (await storageManager.persist());
  } catch {
    return false;
  }
}

/** Devuelve el almacenamiento del navegador, o null si no se puede usar. */
export function browserStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    const probe = `${STORAGE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
