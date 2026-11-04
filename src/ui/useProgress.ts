import { useEffect, useRef, useState } from 'react';
import { reconcileActive } from '../core/session.ts';
import {
  STORAGE_KEY,
  canSave,
  clearProgress,
  loadProgress,
  saveProgress,
  type LoadStatus,
  type StorageLike,
} from '../core/storage.ts';
import { emptyProgress, type Bank, type Progress } from '../core/types.ts';

interface State {
  progress: Progress;
  status: LoadStatus;
}

function readState(bank: Bank, storage: StorageLike | null): State {
  const { progress, status } = loadProgress(storage);
  return { progress: reconcileActive(progress, bank, Date.now()), status };
}

/** Mantiene el progreso en memoria, lo guarda cada vez que cambia y lo sincroniza entre pestañas. */
export function useProgress(bank: Bank, storage: StorageLike | null) {
  const [state, setState] = useState<State>(() => readState(bank, storage));
  const [saveFailed, setSaveFailed] = useState(false);
  const lastSaved = useRef(state.progress);

  useEffect(() => {
    // Sin cambios no se escribe, para no sobrescribir datos ilegibles solo por abrir la app.
    if (state.progress === lastSaved.current || !canSave(state.status)) return;
    lastSaved.current = state.progress;
    setSaveFailed(!saveProgress(storage, state.progress));
  }, [state, storage]);

  // Sin esto, cada pestaña sobrescribiría con su copia lo que haya guardado la otra.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const next = readState(bank, storage);
      lastSaved.current = next.progress;
      setState(next);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [bank, storage]);

  const update = (change: (progress: Progress) => Progress) =>
    setState((current) => ({ ...current, progress: change(current.progress) }));

  const reset = () => {
    const cleared = clearProgress(storage);
    const progress = emptyProgress();
    lastSaved.current = progress;
    setSaveFailed(false);
    setState((current) => ({ progress, status: cleared ? 'ok' : current.status }));
  };

  return { progress: state.progress, status: state.status, saveFailed, update, reset };
}
