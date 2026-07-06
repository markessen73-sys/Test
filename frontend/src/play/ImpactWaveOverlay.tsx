import { useEffect, useState } from 'react';
import type { BagPunchImpact } from './bagImpact';
import type { GlovePosition } from '../types/game';

const WAVE_MS = 920;
const RIPPLE_DELAYS = [0, 0.09, 0.18, 0.27, 0.36, 0.45];

const DEFAULT_BAG_CENTER: GlovePosition = { x: 0.5, y: 0.42 };

interface ImpactWaveOverlayProps {
  impacts: BagPunchImpact[];
  bagCenter?: GlovePosition;
}

export function ImpactWaveOverlay({ impacts, bagCenter = DEFAULT_BAG_CENTER }: ImpactWaveOverlayProps) {
  const [waves, setWaves] = useState<BagPunchImpact[]>([]);

  useEffect(() => {
    if (!impacts.length) return;
    const latest = impacts[impacts.length - 1];
    setWaves((prev) => [...prev, latest]);
    const timer = window.setTimeout(() => {
      setWaves((prev) => prev.filter((w) => w.id !== latest.id));
    }, WAVE_MS);
    return () => window.clearTimeout(timer);
  }, [impacts]);

  return (
    <div className="impact-wave-layer" aria-hidden>
      {waves.map((wave) => (
        <div
          key={wave.id}
          className="bag-impact-wave"
          style={{ left: `${bagCenter.x * 100}%`, top: `${bagCenter.y * 100}%` }}
        >
          {RIPPLE_DELAYS.map((delay, i) => (
            <span
              key={delay}
              className={`bag-impact-wave-ring bag-impact-wave-ring-${i + 1}`}
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
