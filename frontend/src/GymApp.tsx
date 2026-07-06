import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HeavyBagPlayView } from './play/HeavyBagPlayView';
import { BoboDollPlayView } from './play/BoboDollPlayView';
import { SpeedballPlayView } from './play/SpeedballPlayView';
import { RingPlayView } from './play/RingPlayView';
import { BoxingGymScene } from './gym/BoxingGymScene';
import { GYM_STATIONS, type GymStation, type ViewMode } from './types/game';

const STATION_INDEX: Record<GymStation, number> = {
  ring: GYM_STATIONS.findIndex((s) => s.id === 'ring'),
  speedball: GYM_STATIONS.findIndex((s) => s.id === 'speedball'),
  'heavy-bag': GYM_STATIONS.findIndex((s) => s.id === 'heavy-bag'),
  'bobo-doll': GYM_STATIONS.findIndex((s) => s.id === 'bobo-doll'),
};

const PLAY_STATIONS = new Set<GymStation>(['ring', 'speedball', 'heavy-bag', 'bobo-doll']);

export function GymApp() {
  const [stationIndex, setStationIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('browse');

  // Direct link: ?play=heavy-bag (or bobo-doll, speedball, ring)
  useEffect(() => {
    const play = new URLSearchParams(window.location.search).get('play') as GymStation | null;
    if (play && PLAY_STATIONS.has(play) && STATION_INDEX[play] >= 0) {
      setStationIndex(STATION_INDEX[play]);
      setViewMode('play');
    }
  }, []);

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
    if (PLAY_STATIONS.has(station.id)) {
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

  if (viewMode === 'play') {
    switch (station.id) {
      case 'heavy-bag':
        return <HeavyBagPlayView onBack={backToBrowse} />;
      case 'bobo-doll':
        return <BoboDollPlayView onBack={backToBrowse} />;
      case 'speedball':
        return <SpeedballPlayView onBack={backToBrowse} />;
      case 'ring':
        return <RingPlayView onBack={backToBrowse} />;
      default:
        break;
    }
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
                {PLAY_STATIONS.has(station.id) ? `Play ${station.name}` : `Select ${station.name}`}
              </button>
            </>
          ) : PLAY_STATIONS.has(station.id) ? (
            <p className="gym-hint focus-hint">Tap Play above to glove up at this station.</p>
          ) : (
            <p className="gym-hint focus-hint">Play mode coming soon for this station</p>
          )}
        </footer>
      </div>
    </div>
  );
}
