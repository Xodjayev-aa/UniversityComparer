import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearShortlist,
  loadShortlist,
  removeInstitution,
  saveInstitution,
  StorageError,
  subscribeShortlist,
  updateNotes,
  type SavedInstitution,
} from './storage';
import type { Institution, InstitutionSummary } from '../../shared/types';

export function usePageTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · UniScope` : 'UniScope — university discovery with sources';
  }, [title]);
}

export function useRobotsNoIndex(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const existing = document.querySelector('meta[name="robots"]');
    const meta = existing ?? document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('content', 'noindex, nofollow');
    if (!existing) document.head.appendChild(meta);
    return () => {
      if (!existing) meta.remove();
    };
  }, [enabled]);
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

export function useAsync<T>(loader: () => Promise<T>, dependencies: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason : new Error('Something went wrong.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { data, loading, error, reload };
}

interface ShortlistState {
  items: SavedInstitution[];
  error: string | null;
  clearError: () => void;
  save: (summary: InstitutionSummary, full?: Institution | null) => void;
  remove: (id: string) => void;
  setNotes: (id: string, notes: string) => void;
  clear: () => void;
  get: (id: string) => SavedInstitution | null;
}

export function useShortlist(): ShortlistState {
  const [items, setItems] = useState<SavedInstitution[]>(() => loadShortlist());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setItems(loadShortlist());
    const unsubscribe = subscribeShortlist(refresh);
    refresh();
    return unsubscribe;
  }, []);

  const run = useCallback((action: () => void) => {
    try {
      action();
      setItems(loadShortlist());
      setError(null);
    } catch (reason) {
      setError(reason instanceof StorageError ? reason.message : 'Your shortlist could not be saved in this browser.');
    }
  }, []);

  return {
    items,
    error,
    clearError: () => setError(null),
    save: (summary, full = null) => run(() => saveInstitution(summary, full)),
    remove: (id) => run(() => removeInstitution(id)),
    setNotes: (id, notes) => run(() => updateNotes(id, notes)),
    clear: () => run(() => clearShortlist()),
    get: (id) => items.find((item) => item.id === id) ?? null,
  };
}
