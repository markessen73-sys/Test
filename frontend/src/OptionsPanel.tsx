import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useCharacter } from './play/face/CharacterContext';
import type { CharacterId } from './play/face/characters';
import { CreateBoxerFlow, CreatedBoxerCard } from './CreateBoxerFlow';

interface OptionsPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Gym options overlay. Character selection takes effect as soon as the panel closes.
 */
export function OptionsPanel({ open, onClose }: OptionsPanelProps) {
  const {
    characterId,
    builtinCharacters,
    customCharacters,
    setCharacterId,
    removeCustomCharacter,
  } = useCharacter();
  const [draftId, setDraftId] = useState<CharacterId>(characterId);
  const [createOpen, setCreateOpen] = useState(false);

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
        if (createOpen) {
          setCreateOpen(false);
          return;
        }
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, close, createOpen]);

  if (!open) return null;

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
          <h3 className="options-section-title">Character selection</h3>
          <p className="options-section-hint">
            Tap a boxer to select. Your choice applies when you close this panel.
          </p>
          <div className="character-grid">
            {builtinCharacters.map((c) => {
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

        <section className="options-section">
          <h3 className="options-section-title">Created Boxers</h3>
          <p className="options-section-hint">
            Upload a selfie or photo to build your own boxer. They stay here until you delete them.
          </p>
          <div className="character-grid">
            {customCharacters.map((c) => (
              <CreatedBoxerCard
                key={c.id}
                id={c.id}
                name={c.name}
                cleanSrc={c.cleanSrc}
                selected={draftId === c.id}
                onSelect={() => setDraftId(c.id)}
                onDelete={() => {
                  const ok = window.confirm(`Delete ${c.name}? This can’t be undone.`);
                  if (!ok) return;
                  void removeCustomCharacter(c.id).then(() => {
                    setDraftId((cur) => (cur === c.id ? 'default' : cur));
                  });
                }}
              />
            ))}
            <button
              type="button"
              className="character-select-btn character-create-btn"
              onClick={() => setCreateOpen(true)}
            >
              <span className="character-create-icon" aria-hidden>
                <Plus size={28} />
              </span>
              <span className="character-select-name">Create boxer</span>
            </button>
          </div>
        </section>
      </div>

      <CreateBoxerFlow
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setDraftId(id);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
