'use client';

import { useEffect, useRef, useState } from 'react';

// Loading state must not be an effect dependency: setting it would cancel the
// request that just started. Close/unmount aborts the request instead.
export function useMediaCatalog<T>(isOpen: boolean, load: (signal: AbortSignal) => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const cache = useRef<{ items: T[]; loadedAt: number } | null>(null);

  useEffect(() => {
    if (!isOpen) { setIsLoading(false); return; }
    if (cache.current && Date.now() - cache.current.loadedAt < 30_000) {
      setItems(cache.current.items); setIsLoading(false); return;
    }
    const controller = new AbortController();
    setIsLoading(true); setError('');
    void load(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      cache.current = { items: result, loadedAt: Date.now() };
      setItems(result);
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Не вдалося завантажити каталог.');
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, [isOpen, load, refreshKey]);

  function refresh() { cache.current = null; setRefreshKey((value) => value + 1); }
  return { items, isLoading, error, refresh };
}
