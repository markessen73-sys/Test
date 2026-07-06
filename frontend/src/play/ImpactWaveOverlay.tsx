import { useEffect, useState } from 'react';
import type { BagPunchImpact } from './bagImpact';

const WAVE_MS = 580;

interface ImpactWaveOverlayProps {
  impacts: BagPunchImpact[];
}

export function ImpactWaveOverlay({ impacts }: ImpactWaveOverlayProps) {
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
          style={{ left: `${wave.knuckle.x * 100}%`, top: `${wave.knuckle.y * 100}%` }}
        >
          <span className="bag-impact-wave-ring bag-impact-wave-ring-outer" />
          <span className="bag-impact-wave-ring bag-impact-wave-ring-inner" />
        </div>
      ))}
    </div>
  );
}
