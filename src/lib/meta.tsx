import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type MetaResponse } from './api';

interface MetaState {
  meta: MetaResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const MetaContext = createContext<MetaState>({
  meta: null,
  loading: true,
  error: null,
  reload: () => {},
});

export function MetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .meta()
      .then((value) => {
        if (active) setMeta(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Coverage information is unavailable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const value = useMemo(() => ({ meta, loading, error, reload }), [meta, loading, error, reload]);
  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}

export function useMeta(): MetaState {
  return useContext(MetaContext);
}
