import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HeavyBagPlayView } from './play/HeavyBagPlayView';
import { BoxingGymScene } from './gym/BoxingGymScene';
import { GYM_STATIONS, type ViewMode } from './types/game';

export function GymApp() {
  const [stationIndex, setStationIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('browse');

  const station = GYM_STATIONS[stationIndex];

  const goNext = useCallback(() => {
    if (viewMode !== 'browse') return;
    setStationIndex((i) => (i + 1) % GYM_STATIONS.length);
  }, [viewMode]);

  const goPrev = useCallback(() => {
    if (viewMode !== 'browse') return;
    setStationIndex((i) => (i - 1 + GYM_STATIONS.length) % GYM_STATIONS.length);
  }, [viewMode]);

  const selectStation = useCallback(() => {
    if (station.id === 'heavy-bag') {
      setViewMode('play');
    } else {
      setViewMode('focus');
    }
  }, [station.id]);

  const backToBrowse = useCallback(() => {
    setViewMode('browse');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (viewMode === 'browse') {
        if (e.key === 'ArrowRight') goNext();
        if (e.key === 'ArrowLeft') goPrev();
        if (e.key === 'Enter') selectStation();
      }
      if ((viewMode === 'focus' || viewMode === 'play') && e.key === 'Escape') backToBrowse();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewMode, goNext, goPrev, selectStation, backToBrowse]);

  // Heavy bag play view — full glove control mode
  if (viewMode === 'play') {
    return <HeavyBagPlayView onBack={backToBrowse} />;
  }

  return (
    <div className="gym-fullscreen">
      <div className="gym-canvas">
        <BoxingGymScene stationId={station.id} viewMode={viewMode} />
      </div>

      <div className="gym-ui">
        <header className="gym-top">
          {viewMode === 'focus' ? (
            <button type="button" className="gym-back-btn" onClick={backToBrowse}>
              ← Back
            </button>
          ) : (
            <span className="gym-brand">Mickey's Gym</span>
          )}
          <div className="gym-station-title">
            <span className="gym-station-emoji">{station.emoji}</span>
            <span className="gym-station-name">{station.name}</span>
          </div>
          <div className="gym-top-spacer" />
        </header>

        {viewMode === 'browse' && (
          <>
            <button type="button" className="gym-arrow gym-arrow-left" onClick={goPrev} aria-label="Previous">
              <ChevronLeft size={32} />
            </button>
            <button type="button" className="gym-arrow gym-arrow-right" onClick={goNext} aria-label="Next">
              <ChevronRight size={32} />
            </button>
          </>
        )}

        <footer className="gym-bottom">
          {viewMode === 'browse' ? (
            <>
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
              <p className="gym-hint">{station.description}</p>
              <button type="button" className="gym-select-btn" onClick={selectStation}>
                {station.id === 'heavy-bag' ? 'Play Heavy Bag' : `Select ${station.name}`}
              </button>
            </>
          ) : (
            <p className="gym-hint focus-hint">Play mode coming soon for this station</p>
          )}
        </footer>
      </div>
    </div>
  );
}
