import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { setPunchSfxOverride } from '../gameAudio';
import {
  DEFAULT_GLOVE_LOADOUT_ID,
  GLOVE_LOADOUT_LIST,
  GLOVE_LOADOUTS,
  readStoredGloveLoadoutId,
  writeStoredGloveLoadoutId,
  type GloveLoadout,
  type GloveLoadoutId,
} from './gloveLoadout';

interface GloveContextValue {
  gloveId: GloveLoadoutId;
  glove: GloveLoadout;
  gloves: GloveLoadout[];
  setGloveId: (id: GloveLoadoutId) => void;
}

const GloveContext = createContext<GloveContextValue | null>(null);

function syncPunchSfx(id: GloveLoadoutId) {
  setPunchSfxOverride(GLOVE_LOADOUTS[id].punchSfx ?? null);
}

export function GloveProvider({ children }: { children: ReactNode }) {
  const [gloveId, setGloveIdState] = useState<GloveLoadoutId>(() => readStoredGloveLoadoutId());

  useEffect(() => {
    syncPunchSfx(gloveId);
  }, [gloveId]);

  const setGloveId = useCallback((id: GloveLoadoutId) => {
    setGloveIdState(id);
    writeStoredGloveLoadoutId(id);
    syncPunchSfx(id);
  }, []);

  const value = useMemo<GloveContextValue>(
    () => ({
      gloveId,
      glove: GLOVE_LOADOUTS[gloveId],
      gloves: GLOVE_LOADOUT_LIST,
      setGloveId,
    }),
    [gloveId, setGloveId]
  );

  return <GloveContext.Provider value={value}>{children}</GloveContext.Provider>;
}

export function useGlove(): GloveContextValue {
  const ctx = useContext(GloveContext);
  if (!ctx) {
    return {
      gloveId: DEFAULT_GLOVE_LOADOUT_ID,
      glove: GLOVE_LOADOUTS[DEFAULT_GLOVE_LOADOUT_ID],
      gloves: GLOVE_LOADOUT_LIST,
      setGloveId: () => undefined,
    };
  }
  return ctx;
}
