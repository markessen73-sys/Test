import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  BODY_STYLE_LIST,
  BODY_STYLES,
  DEFAULT_BODY_STYLE_ID,
  readStoredBodyStyleId,
  writeStoredBodyStyleId,
  type BodyStyle,
  type BodyStyleId,
} from './bodyStyles';

interface BodyContextValue {
  bodyId: BodyStyleId;
  body: BodyStyle;
  bodies: BodyStyle[];
  setBodyId: (id: BodyStyleId) => void;
}

const BodyContext = createContext<BodyContextValue | null>(null);

export function BodyProvider({ children }: { children: ReactNode }) {
  const [bodyId, setBodyIdState] = useState<BodyStyleId>(() => readStoredBodyStyleId());

  const setBodyId = useCallback((id: BodyStyleId) => {
    setBodyIdState(id);
    writeStoredBodyStyleId(id);
  }, []);

  const value = useMemo<BodyContextValue>(
    () => ({
      bodyId,
      body: BODY_STYLES[bodyId],
      bodies: BODY_STYLE_LIST,
      setBodyId,
    }),
    [bodyId, setBodyId]
  );

  return <BodyContext.Provider value={value}>{children}</BodyContext.Provider>;
}

export function useBody(): BodyContextValue {
  const ctx = useContext(BodyContext);
  if (!ctx) {
    return {
      bodyId: DEFAULT_BODY_STYLE_ID,
      body: BODY_STYLES[DEFAULT_BODY_STYLE_ID],
      bodies: BODY_STYLE_LIST,
      setBodyId: () => undefined,
    };
  }
  return ctx;
}
