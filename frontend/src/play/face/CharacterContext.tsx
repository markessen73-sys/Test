import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  deleteCustomFace,
  getCustomFace,
  isPhotoCharacterId,
  readCustomFaceLibrary,
  resolveFaceFeatures,
  syncFaceFeaturesMeta,
  type CustomFaceEntry,
  type CustomFaceLibrary,
  type CustomFaceSet,
} from '../../face-capture/customFace';
import {
  CHARACTERS,
  CHARACTER_LIST,
  DEFAULT_CHARACTER_ID,
  type CharacterDef,
  type CharacterId,
  readStoredCharacterId,
  writeStoredCharacterId,
} from './characters';
import {
  DAMAGE_STAGE_CLEAN_SRC,
  DAMAGE_STAGE_HOLD_SRC,
  DAMAGE_STAGE_KNOCKOUT_SRC,
  DAMAGE_STAGE_SRCS,
} from './damageStageAssets';

interface CharacterContextValue {
  characterId: CharacterId;
  character: CharacterDef;
  characters: CharacterDef[];
  setCharacterId: (id: CharacterId) => void;
  /** Saved photo faces (library). */
  photoFaces: CustomFaceEntry[];
  refreshPhotoFaces: () => void;
  deletePhotoFace: (id: string) => void;
  /** @deprecated use photoFaces */
  customFace: CustomFaceSet | null;
  /** @deprecated use customFace?.clean */
  customFaceDataUrl: string | null;
  /** @deprecated use refreshPhotoFaces */
  refreshCustomFace: () => void;
}

const CharacterContext = createContext<CharacterContextValue | null>(null);

/** Photo faces use the shared buzz-cut damage HUD ladder. */
function characterFromPhoto(entry: CustomFaceEntry): CharacterDef {
  const stock = CHARACTERS.default;
  const features = resolveFaceFeatures(entry);
  const left = features?.leftEye;
  const right = features?.rightEye;
  const next: CharacterDef = {
    ...stock,
    id: entry.id,
    name: entry.name,
    cleanSrc: entry.clean,
    oohSrc: entry.ooh,
    knockoutSrc: entry.knockout,
    // Live bobo head uses the photo too (HUD clown ladder stays stock).
    boboCleanSrc: entry.clean,
    boboOohSrc: entry.ooh,
    boboLiveKoSrc: entry.knockout,
    damageStageCleanSrc: DAMAGE_STAGE_CLEAN_SRC,
    damageStageSrcs: DAMAGE_STAGE_SRCS,
    damageStageHoldSrc: DAMAGE_STAGE_HOLD_SRC,
    damageStageKnockoutSrc: DAMAGE_STAGE_KNOCKOUT_SRC,
    isPhotoFace: true,
  };
  if (left && right) next.popEyes = { left, right };
  return next;
}

function resolveCharacter(
  id: CharacterId,
  library: CustomFaceLibrary,
): CharacterDef {
  if (isPhotoCharacterId(id)) {
    const entry = library.faces.find((f) => f.id === id);
    if (entry) return characterFromPhoto(entry);
    return CHARACTERS[DEFAULT_CHARACTER_ID];
  }
  return CHARACTERS[id as keyof typeof CHARACTERS] ?? CHARACTERS[DEFAULT_CHARACTER_ID];
}

export function CharacterProvider({ children }: { children: ReactNode }) {
  const [characterId, setCharacterIdState] = useState<CharacterId>(() => readStoredCharacterId());
  const [library, setLibrary] = useState<CustomFaceLibrary>(() => {
    const lib = readCustomFaceLibrary();
    syncFaceFeaturesMeta(lib);
    return lib;
  });

  const setCharacterId = useCallback((id: CharacterId) => {
    setCharacterIdState(id);
    writeStoredCharacterId(id);
  }, []);

  const refreshPhotoFaces = useCallback(() => {
    const next = readCustomFaceLibrary();
    syncFaceFeaturesMeta(next);
    setLibrary(next);
    setCharacterIdState((current) => {
      if (isPhotoCharacterId(current) && !next.faces.some((f) => f.id === current)) {
        writeStoredCharacterId(DEFAULT_CHARACTER_ID);
        return DEFAULT_CHARACTER_ID;
      }
      return current;
    });
  }, []);

  const deletePhotoFace = useCallback(
    (id: string) => {
      const next = deleteCustomFace(id);
      setLibrary(next);
      setCharacterIdState((current) => {
        if (current === id) {
          writeStoredCharacterId(DEFAULT_CHARACTER_ID);
          return DEFAULT_CHARACTER_ID;
        }
        return current;
      });
    },
    [],
  );

  const value = useMemo<CharacterContextValue>(() => {
    const photoChars = library.faces.map(characterFromPhoto);
    // Default Boxer always stays; photo faces are extra slots
    const characters = [...CHARACTER_LIST, ...photoChars];
    const character = resolveCharacter(characterId, library);
    const newest = library.faces[library.faces.length - 1] ?? null;
    return {
      characterId,
      character,
      characters,
      setCharacterId,
      photoFaces: library.faces,
      refreshPhotoFaces,
      deletePhotoFace,
      customFace: newest,
      customFaceDataUrl: newest?.clean ?? null,
      refreshCustomFace: refreshPhotoFaces,
    };
  }, [characterId, library, refreshPhotoFaces, deletePhotoFace, setCharacterId]);

  return <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>;
}

export function useCharacter() {
  const ctx = useContext(CharacterContext);
  if (!ctx) throw new Error('useCharacter must be used within CharacterProvider');
  return ctx;
}

/** Resolve a photo entry for external callers (e.g. after capture). */
export function peekCustomFace(id: string) {
  return getCustomFace(id);
}
