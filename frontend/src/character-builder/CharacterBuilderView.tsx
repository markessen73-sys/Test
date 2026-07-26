import { useCallback, useEffect, useRef, useState } from 'react';
import { Character } from './Character';
import { CharacterRenderer } from './CharacterRenderer';
import {
  LAYER_RENDER_ORDER,
  OPTIONAL_LAYERS,
  type LayerCatalog,
  type LayerKey,
} from './constants';
import { loadLayerCatalog } from './assetCatalog';
import './CharacterBuilderView.css';

const PLACEHOLDER_VARIANTS = 8;

const LAYER_LABELS: Record<LayerKey, string> = {
  head: 'Head',
  skin: 'Skin tone',
  ears: 'Ears',
  eyes: 'Eyes',
  eyebrows: 'Eyebrows',
  nose: 'Nose',
  mouth: 'Mouth',
  hair: 'Hair',
  beard: 'Facial hair',
  glasses: 'Glasses',
  accessories: 'Accessories',
};

function optionsForLayer(layer: LayerKey, catalog: LayerCatalog | null): number[] {
  const listed = catalog?.[layer] ?? [];
  if (listed.length > 0) return listed;
  if (OPTIONAL_LAYERS.has(layer)) return [0, ...range(1, PLACEHOLDER_VARIANTS)];
  return range(1, PLACEHOLDER_VARIANTS);
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

export function CharacterBuilderView() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CharacterRenderer | null>(null);
  const [character] = useState(() => new Character());
  const [catalog, setCatalog] = useState<LayerCatalog | null>(null);
  const [ready, setReady] = useState(false);
  const [json, setJson] = useState(() => JSON.stringify(character.toJSON(), null, 2));

  useEffect(() => {
    const renderer = new CharacterRenderer(character);
    rendererRef.current = renderer;

    if (canvasHostRef.current) {
      const canvas = renderer.getCanvas();
      canvas.className = 'character-builder-canvas';
      canvasHostRef.current.appendChild(canvas);
    }

    loadLayerCatalog()
      .then(setCatalog)
      .then(() => renderer.init())
      .then(() => setReady(true))
      .catch((err) => console.error(err));

    const unsub = character.subscribe(() => {
      setJson(JSON.stringify(character.toJSON(), null, 2));
    });

    return () => {
      unsub();
      renderer.destroy();
      rendererRef.current = null;
      canvasHostRef.current?.replaceChildren();
    };
  }, [character]);

  const setLayer = useCallback(
    (layer: LayerKey, value: number) => {
      character.setLayer(layer, value);
    },
    [character]
  );

  return (
    <div className="character-builder">
      <header className="character-builder-header">
        <h1>Character Builder</h1>
        <p>Stage 1 — modular layer renderer. Faces are assembled from independent layers.</p>
      </header>

      <div className="character-builder-body">
        <div className="character-builder-preview">
          <div ref={canvasHostRef} className="character-builder-canvas-host" />
          {!ready && <p className="character-builder-loading">Loading layers…</p>}
        </div>

        <div className="character-builder-controls">
          {LAYER_RENDER_ORDER.map((layer) => {
            const options = optionsForLayer(layer, catalog);
            const value = character.getLayer(layer);
            return (
              <label key={layer} className="character-builder-control">
                <span>{LAYER_LABELS[layer]}</span>
                <select
                  value={value}
                  onChange={(e) => setLayer(layer, Number(e.target.value))}
                >
                  {options.map((n) => (
                    <option key={n} value={n}>
                      {OPTIONAL_LAYERS.has(layer) && n === 0 ? 'None' : `#${n}`}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>

        <div className="character-builder-json">
          <h2>Character JSON</h2>
          <pre>{json}</pre>
        </div>
      </div>
    </div>
  );
}
