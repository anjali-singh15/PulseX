import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [version, setVersion] = useState(0);
  const [live, setLive] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [modal, setModal] = useState({ open: false, customerId: null, preset: null });
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const loadMeta = useCallback(() => {
    setMetaError(null);
    api.meta().then(setMeta).catch((e) => setMetaError(e.message));
  }, []);
  useEffect(loadMeta, [loadMeta]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Live updates: any event processed by the API (simulator, sync, another tab) bumps the version.
  useEffect(() => {
    let es;
    let retry;
    let debounce;
    const connect = () => {
      es = new EventSource(api.streamUrl);
      es.onopen = () => setLive(true);
      es.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.kind === 'hello') return;
        } catch { /* ignore malformed frames */ }
        clearTimeout(debounce);
        debounce = setTimeout(() => setVersion((v) => v + 1), 120);
      };
      es.onerror = () => {
        setLive(false);
        es.close();
        retry = setTimeout(connect, 4000);
      };
    };
    connect();
    return () => { clearTimeout(retry); clearTimeout(debounce); es?.close(); };
  }, []);

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((t) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((list) => [...list.slice(-3), { id, tone: 'info', ...t }]);
    setTimeout(() => dismissToast(id), t.duration || 5000);
  }, [dismissToast]);

  const openEventModal = useCallback((customerId = null, preset = null) => setModal({ open: true, customerId, preset }), []);
  const closeEventModal = useCallback(() => setModal((m) => ({ ...m, open: false })), []);

  const recordResult = useCallback((result) => {
    setLastResult({ ...result, receivedAt: Date.now() });
    setVersion((v) => v + 1);
  }, []);

  const value = useMemo(() => ({
    meta, metaError, loadMeta, version, refresh, live,
    lastResult, recordResult, clearLastResult: () => setLastResult(null),
    modal, openEventModal, closeEventModal,
    toasts, toast, dismissToast,
  }), [meta, metaError, loadMeta, version, refresh, live, lastResult, recordResult, modal, openEventModal, closeEventModal, toasts, toast, dismissToast]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
