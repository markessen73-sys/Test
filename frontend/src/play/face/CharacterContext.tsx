import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

export function CharacterProvider({ children }: { children: ReactNode }) {
  const [characterId, setCharacterIdState] = useState<CharacterId>(() => readStoredCharacterId());

  const setCharacterId = useCallback((id: CharacterId) => {
    setCharacterIdState(id);
    writeStoredCharacterId(id);
  }, []);

  const value = useMemo<CharacterContextValue>(
    () => ({
      characterId,
      character: CHARACTERS[characterId],
      characters: CHARACTER_LIST,
      setCharacterId,
    }),
    [characterId, setCharacterId]
  );

  return <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>;
}

export function useCharacter() {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error('useCharacter must be used within CharacterProvider');
  return ctx;
}
