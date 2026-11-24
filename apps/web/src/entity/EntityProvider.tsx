import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, errorMessage } from '../api/client';
import type { Entity } from '../api/types';

interface EntityState {
  entities: Entity[];
  current: Entity | null;
  select: (id: string) => void;
  error: string | null;
}

const EntityContext = createContext<EntityState | null>(null);
const STORAGE_KEY = 'ledgerline.entity';

function storedId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function EntityProvider({ children }: { children: ReactNode }) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selected, setSelected] = useState<string | null>(storedId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Entity[]>('/entities')
      .then(setEntities)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);

  const value = useMemo<EntityState>(() => {
    const current = entities.find((e) => e.id === selected) ?? entities[0] ?? null;
    return {
      entities,
      current,
      error,
      select: (id) => {
        setSelected(id);
        try {
          localStorage.setItem(STORAGE_KEY, id);
        } catch {
          /* storage unavailable: selection lasts for this tab only */
        }
      },
    };
  }, [entities, selected, error]);

  return <EntityContext.Provider value={value}>{children}</EntityContext.Provider>;
}

export function useEntity(): EntityState {
  const ctx = useContext(EntityContext);
  if (!ctx) throw new Error('useEntity must be used inside EntityProvider');
  return ctx;
}
