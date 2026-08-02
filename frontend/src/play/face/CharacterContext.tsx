import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { readCustomFaceSet, type CustomFaceSet } from '../../face-capture/customFace';
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
  customFace: CustomFaceSet | null;
  /** @deprecated use customFace?.clean */
  customFaceDataUrl: string | null;
  refreshCustomFace: () => void;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

/** When the user has fitted photos, use them for the Default boxer live faces.
 * Damage meter uses baked photo damage stages when available. */
function applyCustomFace(def: CharacterDef, custom: CustomFaceSet | null): CharacterDef {
  if (!custom || def.id !== 'default') return def;
  const next: CharacterDef = {
    ...def,
    cleanSrc: custom.clean,
    oohSrc: custom.ooh,
    knockoutSrc: custom.knockout,
    name: 'My face',
  };
  if (custom.damageStages?.length) {
    next.damageStageCleanSrc = custom.clean;
    next.damageStageSrcs = custom.damageStages;
    next.damageStageHoldSrc = custom.ooh;
    next.damageStageKnockoutSrc = custom.damageKnockout ?? custom.knockout;
  }
  return next;
}

export function CharacterProvider({ children }: { children: ReactNode }) {
  const [characterId, setCharacterIdState] = useState<CharacterId>(() => readStoredCharacterId());
  const [customFace, setCustomFace] = useState<CustomFaceSet | null>(() => readCustomFaceSet());

  const setCharacterId = useCallback((id: CharacterId) => {
    setCharacterIdState(id);
    writeStoredCharacterId(id);
  }, []);

  const refreshCustomFace = useCallback(() => {
    setCustomFace(readCustomFaceSet());
  }, []);

  const value = useMemo<CharacterContextValue>(() => {
    const characters = CHARACTER_LIST.map((c) => applyCustomFace(c, customFace));
    const character = applyCustomFace(CHARACTERS[characterId], customFace);
    return {
      characterId,
      character,
      characters,
      setCharacterId,
      customFace,
      customFaceDataUrl: customFace?.clean ?? null,
      refreshCustomFace,
    };
  }, [characterId, customFace, refreshCustomFace, setCharacterId]);

  return <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>;
}

export function useCharacter() {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error('useCharacter must be used within CharacterProvider');
  return ctx;
}
