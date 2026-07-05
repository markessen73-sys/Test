import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BoxingGymScene } from '../gym/BoxingGymScene';
import { GYM_STATIONS, type PunchType } from '../types/game';

const PUNCH_LABELS: Record<PunchType, string> = {
  jab: 'JAB!',
  cross: 'CROSS!',
  hook: 'HOOK!',
  uppercut: 'UPPERCUT!',
  body: 'BODY SHOT!',
};

interface GymStepProps {
  caricatureUrl: string;
  styleName: string;
  onBack: () => void;
  onRestart: () => void;
}

export function GymStep({ caricatureUrl, styleName, onBack, onRestart }: GymStepProps) {
  const [stationIndex, setStationIndex] = useState(0);
  const [lastPunch, setLastPunch] = useState<PunchType | null>(null);
  const [combo, setCombo] = useState(0);
  const [hitCount, setHitCount] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const comboTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const station = GYM_STATIONS[stationIndex];

  const goNext = useCallback(() => {
    setStationIndex((i) => (i + 1) % GYM_STATIONS.length);
    setLastPunch(null);
  }, []);

  const goPrev = useCallback(() => {
    setStationIndex((i) => (i - 1 + GYM_STATIONS.length) % GYM_STATIONS.length);
    setLastPunch(null);
  }, []);

  const handlePunch = useCallback((type: PunchType) => {
    setLastPunch(type);
    setHitCount((c) => c + 1);
    setCombo((c) => c + 1);
    setFlash(PUNCH_LABELS[type]);

    clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => {
      setCombo(0);
      setLastPunch(null);
    }, 1200);
    setTimeout(() => setFlash(null), 600);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  useEffect(() => () => clearTimeout(comboTimer.current), []);

  return (
    <div className="gym-container">
      <div className="gym-hud">
        <div className="gym-hud-left">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
            ← New fighter
          </button>
          <img src={caricatureUrl} alt="" className="gym-hud-thumb" />
          <span className="gym-fighter-name">{styleName}</span>
        </div>
        <div className="gym-hud-center">
          <span className="gym-station-label">
            {station.emoji} {station.name}
          </span>
          {flash && <div className="punch-flash">{flash}</div>}
          {combo > 1 && <div className="combo-counter">{combo}x COMBO!</div>}
        </div>
        <div className="gym-hud-right">
          <span className="hit-counter">{hitCount} hits</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRestart}>
            Exit
          </button>
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

        <BoxingGymScene
          stationId={station.id}
          caricatureUrl={caricatureUrl}
          onPunch={handlePunch}
          lastPunch={lastPunch}
          combo={combo}
        />

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
        <p className="gym-hint">{station.description} — <strong>click to punch!</strong></p>
      </div>
    </div>
  );
}
