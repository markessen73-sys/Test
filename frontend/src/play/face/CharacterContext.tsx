import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  BUILTIN_CHARACTER_LIST,
  BUILTIN_CHARACTERS,
  DEFAULT_CHARACTER_ID,
  characterDefFromCustomPack,
  revokeCharacterObjectUrls,
  type CharacterDef,
  type CharacterId,
  isBuiltinCharacterId,
  readStoredCharacterId,
  writeStoredCharacterId,
} from './characters';
import {
  deleteCustomBoxerPack,
  listCustomBoxerPacks,
  type CustomBoxerPackRecord,
} from './custom/customBoxerStorage';

interface CharacterContextValue {
  characterId: CharacterId;
  character: CharacterDef;
  /** Built-in boxers only. */
  builtinCharacters: CharacterDef[];
  /** User-created boxers. */
  customCharacters: CharacterDef[];
  /** Built-ins + created, for pickers that show everything. */
  characters: CharacterDef[];
  ready: boolean;
  setCharacterId: (id: CharacterId) => void;
  refreshCustomCharacters: () => Promise<void>;
  removeCustomCharacter: (id: CharacterId) => Promise<void>;
  addCustomPack: (pack: CustomBoxerPackRecord) => CharacterDef;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

export function CharacterProvider({ children }: { children: ReactNode }) {
  const [characterId, setCharacterIdState] = useState<CharacterId>(() => readStoredCharacterId());
  const [customCharacters, setCustomCharacters] = useState<CharacterDef[]>([]);
  const [ready, setReady] = useState(false);

  const refreshCustomCharacters = useCallback(async () => {
    const packs = await listCustomBoxerPacks();
    setCustomCharacters((prev) => {
      for (const c of prev) revokeCharacterObjectUrls(c);
      return packs.map(characterDefFromCustomPack);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshCustomCharacters();
      } catch {
        /* IndexedDB unavailable */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshCustomCharacters]);

  // If stored id is a missing custom boxer, fall back to default once ready.
  useEffect(() => {
    if (!ready) return;
    if (isBuiltinCharacterId(characterId)) return;
    if (!customCharacters.some((c) => c.id === characterId)) {
      setCharacterIdState(DEFAULT_CHARACTER_ID);
      writeStoredCharacterId(DEFAULT_CHARACTER_ID);
    }
  }, [ready, characterId, customCharacters]);

  const setCharacterId = useCallback((id: CharacterId) => {
    setCharacterIdState(id);
    writeStoredCharacterId(id);
  }, []);

  const addCustomPack = useCallback((pack: CustomBoxerPackRecord) => {
    const def = characterDefFromCustomPack(pack);
    setCustomCharacters((prev) => {
      const without = prev.filter((c) => c.id !== def.id);
      return [def, ...without];
    });
    return def;
  }, []);

  const removeCustomCharacter = useCallback(
    async (id: CharacterId) => {
      await deleteCustomBoxerPack(id);
      setCustomCharacters((prev) => {
        const doomed = prev.find((c) => c.id === id);
        if (doomed) revokeCharacterObjectUrls(doomed);
        return prev.filter((c) => c.id !== id);
      });
      setCharacterIdState((cur) => {
        if (cur !== id) return cur;
        writeStoredCharacterId(DEFAULT_CHARACTER_ID);
        return DEFAULT_CHARACTER_ID;
      });
    },
    []
  );

  const characters = useMemo(
    () => [...BUILTIN_CHARACTER_LIST, ...customCharacters],
    [customCharacters]
  );

  const character = useMemo(() => {
    if (isBuiltinCharacterId(characterId)) return BUILTIN_CHARACTERS[characterId];
    return customCharacters.find((c) => c.id === characterId) ?? BUILTIN_CHARACTERS.default;
  }, [characterId, customCharacters]);

  const value = useMemo<CharacterContextValue>(
    () => ({
      characterId,
      character,
      builtinCharacters: BUILTIN_CHARACTER_LIST,
      customCharacters,
      characters,
      ready,
      setCharacterId,
      refreshCustomCharacters,
      removeCustomCharacter,
      addCustomPack,
    }),
    [
      characterId,
      character,
      customCharacters,
      characters,
      ready,
      setCharacterId,
      refreshCustomCharacters,
      removeCustomCharacter,
      addCustomPack,
    ]
  );

  return <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>;
}

export function useCharacter() {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error('useCharacter must be used within CharacterProvider');
  return ctx;
}
