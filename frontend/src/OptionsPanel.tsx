import { useCallback, useEffect, useState } from 'react';
import { useCharacter } from './play/face/CharacterContext';
import type { CharacterId } from './play/face/characters';

interface OptionsPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Gym options overlay. Character selection takes effect as soon as the panel closes.
 */
export function OptionsPanel({ open, onClose }: OptionsPanelProps) {
  const { characterId, characters, setCharacterId, deletePhotoFace } = useCharacter();
  const [draftId, setDraftId] = useState<CharacterId>(characterId);

  useEffect(() => {
    if (open) setDraftId(characterId);
  }, [open, characterId]);

  const close = useCallback(() => {
    setCharacterId(draftId);
    onClose();
  }, [draftId, onClose, setCharacterId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  if (!open) return null;

  const stockChars = characters.filter((c) => !c.isPhotoFace);
  const photoChars = characters.filter((c) => c.isPhotoFace);

  return (
    <div className="options-overlay" role="dialog" aria-modal="true" aria-label="Options">
      <button type="button" className="options-backdrop" aria-label="Close options" onClick={close} />
      <div className="options-panel">
        <header className="options-header">
          <h2 className="options-title">Options</h2>
          <button type="button" className="options-close" onClick={close} aria-label="Close options">
            ✕
          </button>
        </header>

        <section className="options-section">
          <h3 className="options-section-title">Your photo faces</h3>
          <p className="options-section-hint">
            Add as many photo faces as you like. Each one appears in the character list. Delete any you
            don’t want.
          </p>
          <a className="options-link-btn" href="?builder=face">
            Add photo face
          </a>
          {photoChars.length > 0 && (
            <ul className="photo-face-list">
              {photoChars.map((c) => {
                const selected = draftId === c.id;
                return (
                  <li key={c.id} className={`photo-face-row ${selected ? 'is-selected' : ''}`}>
                    <button
                      type="button"
                      className="photo-face-select"
                      aria-pressed={selected}
                      onClick={() => setDraftId(c.id)}
                    >
                      <img className="photo-face-thumb" src={c.cleanSrc} alt="" draggable={false} />
                      <span className="photo-face-name">{c.name}</span>
                    </button>
                    <button
                      type="button"
                      className="photo-face-delete"
                      aria-label={`Delete ${c.name}`}
                      onClick={() => {
                        if (draftId === c.id) setDraftId('default');
                        deletePhotoFace(c.id);
                      }}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="options-section">
          <h3 className="options-section-title">Character selection</h3>
          <p className="options-section-hint">
            Tap a boxer to select. Your choice applies when you close this panel. Default Boxer is always
            available.
          </p>
          <div className="character-grid">
            {stockChars.map((c) => {
              const selected = draftId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`character-select-btn ${selected ? 'is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => setDraftId(c.id)}
                >
                  <img className="character-select-face" src={c.cleanSrc} alt="" draggable={false} />
                  <span className="character-select-name">{c.name}</span>
                </button>
              );
            })}
            {photoChars.map((c) => {
              const selected = draftId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`character-select-btn ${selected ? 'is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => setDraftId(c.id)}
                >
                  <img className="character-select-face" src={c.cleanSrc} alt="" draggable={false} />
                  <span className="character-select-name">{c.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
