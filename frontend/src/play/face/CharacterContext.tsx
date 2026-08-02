import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { readCustomFaceDataUrl } from '../../face-capture/customFace';
import {
  CHARACTERS,
  CHARACTER_LIST,
  type CharacterDef,
  type CharacterId,
  readStoredCharacterId,
  writeStoredCharacterId,
} from './characters';

interface CharacterContextValue {
  characterId: CharacterId;
  character: CharacterDef;
  characters: CharacterDef[];
  setCharacterId: (id: CharacterId) => void;
  customFaceDataUrl: string | null;
  refreshCustomFace: () => void;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

/** When the user has fitted a photo, use it for the Default boxer expressions. */
function applyCustomFace(def: CharacterDef, custom: string | null): CharacterDef {
  if (!custom || def.id !== 'default') return def;
  return {
    ...def,
    cleanSrc: custom,
    oohSrc: custom,
    knockoutSrc: custom,
    damageStageCleanSrc: custom,
    damageStageHoldSrc: custom,
    damageStageKnockoutSrc: custom,
    name: 'My face',
  };
}

export function CharacterProvider({ children }: { children: ReactNode }) {
  const [characterId, setCharacterIdState] = useState<CharacterId>(() => readStoredCharacterId());
  const [customFaceDataUrl, setCustomFaceDataUrl] = useState<string | null>(() =>
    readCustomFaceDataUrl()
  );

  const setCharacterId = useCallback((id: CharacterId) => {
    setCharacterIdState(id);
    writeStoredCharacterId(id);
  }, []);

  const refreshCustomFace = useCallback(() => {
    setCustomFaceDataUrl(readCustomFaceDataUrl());
  }, []);

  const value = useMemo<CharacterContextValue>(() => {
    const characters = CHARACTER_LIST.map((c) => applyCustomFace(c, customFaceDataUrl));
    const character = applyCustomFace(CHARACTERS[characterId], customFaceDataUrl);
    return {
      characterId,
      character,
      characters,
      setCharacterId,
      customFaceDataUrl,
      refreshCustomFace,
    };
  }, [characterId, customFaceDataUrl, refreshCustomFace, setCharacterId]);

  return <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>;
}

export function useCharacter() {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error('useCharacter must be used within CharacterProvider');
  return ctx;
}
