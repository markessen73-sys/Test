import { useCallback, useEffect, useState } from 'react';
import { useCharacter } from './play/face/CharacterContext';
import type { CharacterId } from './play/face/characters';
import { useGlove } from './play/GloveContext';
import type { GloveLoadoutId } from './play/gloveLoadout';
import { useBody } from './play/BodyContext';
import type { BodyStyleId } from './play/bodyStyles';

interface OptionsPanelProps {
  open: boolean;
  onClose: () => void;
}

type OptionsView = 'menu' | 'gloves' | 'boxers' | 'bodies';

function GlovePowerBar({ power }: { power: number }) {
  const clamped = Math.max(0, Math.min(100, power));
  return (
    <div className="glove-power" aria-label={`Power ${clamped} out of 100`}>
      <div className="glove-power-track">
        <div
          className="glove-power-fill"
          style={{
            width: `${clamped}%`,
            // Stretch the green→red gradient across the full track so fill colour
            // matches absolute power (green low → red high).
            backgroundSize: `${10000 / Math.max(clamped, 1)}% 100%`,
          }}
        />
      </div>
      <span className="glove-power-label">{clamped}/100</span>
    </div>
  );
}

/**
 * Gym options overlay. Top level is Gloves / Boxers / Bodies; selections apply on close.
 */
export function OptionsPanel({ open, onClose }: OptionsPanelProps) {
  const { characterId, characters, setCharacterId, deletePhotoFace } = useCharacter();
  const { gloveId, gloves, setGloveId } = useGlove();
  const { bodyId, bodies, setBodyId } = useBody();
  const [view, setView] = useState<OptionsView>('menu');
  const [draftCharacterId, setDraftCharacterId] = useState<CharacterId>(characterId);
  const [draftGloveId, setDraftGloveId] = useState<GloveLoadoutId>(gloveId);
  const [draftBodyId, setDraftBodyId] = useState<BodyStyleId>(bodyId);

  useEffect(() => {
    if (!open) return;
    setView('menu');
    setDraftCharacterId(characterId);
    setDraftGloveId(gloveId);
    setDraftBodyId(bodyId);
  }, [open, characterId, gloveId, bodyId]);

  const close = useCallback(() => {
    setCharacterId(draftCharacterId);
    setGloveId(draftGloveId);
    setBodyId(draftBodyId);
    onClose();
  }, [draftCharacterId, draftGloveId, draftBodyId, onClose, setCharacterId, setGloveId, setBodyId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (view !== 'menu') {
          setView('menu');
          return;
        }
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, close, view]);

  if (!open) return null;

  const stockChars = characters.filter((c) => !c.isPhotoFace);
  const photoChars = characters.filter((c) => c.isPhotoFace);

  const title =
    view === 'gloves'
      ? 'Gloves'
      : view === 'boxers'
        ? 'Boxers'
        : view === 'bodies'
          ? 'Bodies'
          : 'Options';

  return (
    <div className="options-overlay" role="dialog" aria-modal="true" aria-label="Options">
      <button type="button" className="options-backdrop" aria-label="Close options" onClick={close} />
      <div className="options-panel">
        <header className="options-header">
          {view !== 'menu' ? (
            <button type="button" className="options-back" onClick={() => setView('menu')}>
              ← Back
            </button>
          ) : (
            <span className="options-back-spacer" />
          )}
          <h2 className="options-title">{title}</h2>
          <button type="button" className="options-close" onClick={close} aria-label="Close options">
            ✕
          </button>
        </header>

        {view === 'menu' && (
          <nav className="options-menu" aria-label="Options menu">
            <p className="options-menu-lead">Gear up before you hit the floor.</p>
            <button type="button" className="options-menu-btn" onClick={() => setView('gloves')}>
              <span className="options-menu-btn-label">Gloves</span>
              <span className="options-menu-btn-hint">Power, style, and special sets</span>
            </button>
            <button type="button" className="options-menu-btn" onClick={() => setView('boxers')}>
              <span className="options-menu-btn-label">Boxers</span>
              <span className="options-menu-btn-hint">Stock faces and your photo faces</span>
            </button>
            <button type="button" className="options-menu-btn" onClick={() => setView('bodies')}>
              <span className="options-menu-btn-label">Bodies</span>
              <span className="options-menu-btn-hint">Ring sparring partner styles</span>
            </button>
          </nav>
        )}

        {view === 'gloves' && (
          <section className="options-section">
            <p className="options-section-hint">
              Tap a set to preview. Power is punch strength out of 100. Saved when you close.
            </p>
            <div className="glove-grid">
              {gloves.map((g) => {
                const selected = draftGloveId === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={`glove-select-btn ${selected ? 'is-selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => setDraftGloveId(g.id)}
                  >
                    <img
                      className={`glove-select-thumb glove-select-thumb-${g.skin}`}
                      src={g.thumbSrc}
                      alt=""
                      draggable={false}
                    />
                    <span className="glove-select-name">{g.name}</span>
                    <GlovePowerBar power={g.power} />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {view === 'bodies' && (
          <section className="options-section">
            <p className="options-section-hint">
              Pick a sparring body for The Ring. Generic is the classic silhouette. Saved when you
              close.
            </p>
            <div className="body-grid">
              {bodies.map((b) => {
                const selected = draftBodyId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`body-select-btn ${selected ? 'is-selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => setDraftBodyId(b.id)}
                  >
                    <img className="body-select-thumb" src={b.thumbSrc} alt="" draggable={false} />
                    <span className="body-select-name">{b.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {view === 'boxers' && (
          <>
            <section className="options-section">
              <h3 className="options-section-title">Your photo faces</h3>
              <p className="options-section-hint">
                Add photo faces for the bag, ring, and bobo. Delete any you don’t want.
              </p>
              <a className="options-link-btn" href="?builder=face">
                Add photo face
              </a>
              {photoChars.length > 0 && (
                <ul className="photo-face-list">
                  {photoChars.map((c) => {
                    const selected = draftCharacterId === c.id;
                    return (
                      <li key={c.id} className={`photo-face-row ${selected ? 'is-selected' : ''}`}>
                        <button
                          type="button"
                          className="photo-face-select"
                          aria-pressed={selected}
                          onClick={() => setDraftCharacterId(c.id)}
                        >
                          <img className="photo-face-thumb" src={c.cleanSrc} alt="" draggable={false} />
                          <span className="photo-face-name">{c.name}</span>
                        </button>
                        <button
                          type="button"
                          className="photo-face-delete"
                          aria-label={`Delete ${c.name}`}
                          onClick={() => {
                            if (draftCharacterId === c.id) setDraftCharacterId('default');
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
                Tap a boxer to select. Saved when you close. Default Boxer is always available.
              </p>
              <div className="character-grid">
                {stockChars.map((c) => {
                  const selected = draftCharacterId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`character-select-btn ${selected ? 'is-selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => setDraftCharacterId(c.id)}
                    >
                      <img className="character-select-face" src={c.cleanSrc} alt="" draggable={false} />
                      <span className="character-select-name">{c.name}</span>
                    </button>
                  );
                })}
                {photoChars.map((c) => {
                  const selected = draftCharacterId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`character-select-btn ${selected ? 'is-selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => setDraftCharacterId(c.id)}
                    >
                      <img className="character-select-face" src={c.cleanSrc} alt="" draggable={false} />
                      <span className="character-select-name">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
