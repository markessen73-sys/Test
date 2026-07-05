import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BoxingGymScene } from './gym/BoxingGymScene';
import { GYM_STATIONS } from './types/game';

export function GymApp() {
  const [stationIndex, setStationIndex] = useState(0);
  const [hitCount, setHitCount] = useState(0);
  const [lastHit, setLastHit] = useState<string | null>(null);

  const station = GYM_STATIONS[stationIndex];

  const goNext = useCallback(() => {
    setStationIndex((i) => (i + 1) % GYM_STATIONS.length);
  }, []);

  const goPrev = useCallback(() => {
    setStationIndex((i) => (i - 1 + GYM_STATIONS.length) % GYM_STATIONS.length);
  }, []);

  const handleHit = useCallback(() => {
    setHitCount((c) => c + 1);
    setLastHit('POW!');
    setTimeout(() => setLastHit(null), 400);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  return (
    <div className="gym-container">
      <div className="gym-hud">
        <div className="gym-hud-left">
          <span className="gym-brand">🥊 Mickey's Gym</span>
        </div>
        <div className="gym-hud-center">
          <span className="gym-station-label">
            {station.emoji} {station.name}
          </span>
          {lastHit && <div className="punch-flash">{lastHit}</div>}
        </div>
        <div className="gym-hud-right">
          <span className="hit-counter">{hitCount} hits</span>
        </div>
      </div>

      <div className="gym-scene-wrap">
        <button
          type="button"
          className="gym-arrow gym-arrow-left"
          onClick={goPrev}
          aria-label="Previous station"
        >
          <ChevronLeft size={36} />
        </button>

        <BoxingGymScene stationId={station.id} onHit={handleHit} />

        <button
          type="button"
          className="gym-arrow gym-arrow-right"
          onClick={goNext}
          aria-label="Next station"
        >
          <ChevronRight size={36} />
        </button>
      </div>

      <div className="gym-footer">
        <div className="station-dots">
          {GYM_STATIONS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`station-dot ${i === stationIndex ? 'active' : ''}`}
              onClick={() => setStationIndex(i)}
              title={s.name}
            >
              {s.emoji}
            </button>
          ))}
        </div>
        <p className="gym-hint">
          {station.description} — use <strong>◀ ▶</strong> to move around the gym
        </p>
      </div>
    </div>
  );
}
