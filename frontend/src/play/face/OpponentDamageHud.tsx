import { useEffect, useRef } from 'react';
import { ALL_FACE_DAMAGES, type FaceDamageId } from './faceDamage';
import {
  loadDamagedFaceAssets,
  renderDamagedFace,
  type DamagedFaceAssets,
} from './renderDamagedFace';

const FACE_PX = 148;

interface OpponentDamageHudProps {
  damages: readonly FaceDamageId[];
}

/**
 * Top-right portrait that accumulates punch injuries + a fill meter to 100%.
 * The live 3D partner face stays clean; this HUD owns the damage stamps.
 */
export function OpponentDamageHud({ damages }: OpponentDamageHudProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const assetsRef = useRef<DamagedFaceAssets | null>(null);
  const damagesRef = useRef(damages);
  damagesRef.current = damages;

  const pct = Math.round((damages.length / ALL_FACE_DAMAGES.length) * 100);
  const damagesKey = damages.join(',');

  const paint = () => {
    const canvas = canvasRef.current;
    const assets = assetsRef.current;
    if (!canvas || !assets) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderDamagedFace(ctx, FACE_PX, FACE_PX, assets, damagesRef.current);
  };

  useEffect(() => {
    let cancelled = false;
    loadDamagedFaceAssets().then((assets) => {
      if (cancelled) return;
      assetsRef.current = assets;
      paint();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    paint();
  }, [damagesKey]);

  return (
    <aside className="play-damage-hud" aria-label={`Damage meter ${pct} percent`}>
      <div className="play-damage-hud-frame">
        <canvas
          ref={canvasRef}
          className="play-damage-hud-face"
          width={FACE_PX}
          height={FACE_PX}
        />
        <div className="play-damage-hud-meter">
          <div className="play-damage-hud-meter-label">
            <span>DAMAGE</span>
            <span>{pct}%</span>
          </div>
          <div className="play-damage-hud-meter-track">
            <div
              className="play-damage-hud-meter-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
