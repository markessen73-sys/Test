import { useEffect, useRef } from 'react';
import {
  loadDamagedFaceAssets,
  renderDamagedFace,
  type DamagedFaceAssets,
} from './renderDamagedFace';

const FACE_PX = 96;

interface OpponentDamageHudProps {
  /** Damage meter stage 0–10 (each step = 10%). */
  stage: number;
}

/**
 * Top-right portrait that swaps through the pre-baked cumulative injury
 * caricatures every 10% damage, then the knockout face at 100%.
 */
export function OpponentDamageHud({ stage }: OpponentDamageHudProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const assetsRef = useRef<DamagedFaceAssets | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  const pct = Math.max(0, Math.min(100, stage * 10));
  const knockedOut = pct >= 100;

  const paint = () => {
    const canvas = canvasRef.current;
    const assets = assetsRef.current;
    if (!canvas || !assets) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderDamagedFace(ctx, FACE_PX, FACE_PX, assets, stageRef.current);
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
  }, [stage]);

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
            <span>{knockedOut ? 'K.O.' : 'DAMAGE'}</span>
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
