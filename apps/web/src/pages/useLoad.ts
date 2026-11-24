import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';

/** Load data for a key; refetches when the key changes. Returns a reload function too. */
export function useLoad<T>(key: string | null, load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (key === null) return;
    let active = true;
    setError(null);
    load()
      .then((value) => active && setData(value))
      .catch((e: unknown) => active && setError(errorMessage(e)));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
  return { data, error, reload: () => setVersion((v) => v + 1) };
}
