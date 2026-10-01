import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';

/**
 * Loads data and reloads it whenever the app-wide data version changes (a new event,
 * a sync, a reseed). Existing data stays on screen while reloading, so live updates
 * never flash a spinner.
 */
export function useApi(fetcher, deps = [], { enabled = true } = {}) {
  const { version } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [local, setLocal] = useState(0);
  const req = useRef(0);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    const id = ++req.current;
    setLoading(true);
    fetcher()
      .then((d) => { if (id === req.current) { setData(d); setError(null); } })
      .catch((e) => { if (id === req.current) setError(e); })
      .finally(() => { if (id === req.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version, local, enabled]);

  // When the identity of the request changes (e.g. another customer), drop stale data.
  const key = JSON.stringify(deps);
  const lastKey = useRef(key);
  if (lastKey.current !== key) {
    lastKey.current = key;
    if (data !== null) setData(null);
  }

  const reload = useCallback(() => setLocal((n) => n + 1), []);
  return { data, error, loading, reload, initialLoading: loading && data === null };
}
