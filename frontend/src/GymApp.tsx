import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { setBackgroundMusicBed, setBackgroundMusicPlayMode } from './backgroundMusic';
import { unlockGameAudio } from './gameAudio';
import { HeavyBagPlayView } from './play/HeavyBagPlayView';
import { BoboDollPlayView } from './play/BoboDollPlayView';
import { SpeedballPlayView } from './play/SpeedballPlayView';
import { RingPlayView } from './play/RingPlayView';
import { BoxingGymScene } from './gym/BoxingGymScene';
import { OptionsPanel } from './OptionsPanel';
import { TitleScreen } from './screens/TitleScreen';
import { InstructionsScreen } from './screens/InstructionsScreen';
import { GYM_STATIONS, type GymStation, type ViewMode } from './types/game';

type AppScreen = 'title' | 'howto' | 'gym';

const STATION_INDEX: Record<GymStation, number> = {
  ring: GYM_STATIONS.findIndex((s) => s.id === 'ring'),
  speedball: GYM_STATIONS.findIndex((s) => s.id === 'speedball'),
  'heavy-bag': GYM_STATIONS.findIndex((s) => s.id === 'heavy-bag'),
  'bobo-doll': GYM_STATIONS.findIndex((s) => s.id === 'bobo-doll'),
};

const PLAY_STATIONS = new Set<GymStation>(['ring', 'speedball', 'heavy-bag', 'bobo-doll']);

function initialScreenFromUrl(): { screen: AppScreen; stationIndex: number; viewMode: ViewMode } {
  const params = new URLSearchParams(window.location.search);
  const gym = params.get('gym');
  if (gym !== null) {
    const idx =
      gym && PLAY_STATIONS.has(gym as GymStation) && STATION_INDEX[gym as GymStation] >= 0
        ? STATION_INDEX[gym as GymStation]
        : 0;
    return { screen: 'gym', stationIndex: idx, viewMode: 'browse' };
  }

  const play = params.get('play') as GymStation | null;
  if (play && PLAY_STATIONS.has(play) && STATION_INDEX[play] >= 0) {
    return { screen: 'gym', stationIndex: STATION_INDEX[play], viewMode: 'play' };
  }

  return { screen: 'title', stationIndex: 0, viewMode: 'browse' };
}

export function GymApp() {
  const boot = initialScreenFromUrl();
  const [appScreen, setAppScreen] = useState<AppScreen>(boot.screen);
  const [stationIndex, setStationIndex] = useState(boot.stationIndex);
  const [viewMode, setViewMode] = useState<ViewMode>(boot.viewMode);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [howtoReturn, setHowtoReturn] = useState<AppScreen>('title');

  const station = GYM_STATIONS[stationIndex];

  useEffect(() => {
    const isBoboPlay = appScreen === 'gym' && viewMode === 'play' && station.id === 'bobo-doll';
    setBackgroundMusicBed(isBoboPlay ? 'bobo' : 'gym');
    // Duck gym ambience in play (except bobo's own bed). Title/howto keep full bed.
    setBackgroundMusicPlayMode(appScreen === 'gym' && viewMode === 'play' && !isBoboPlay);
  }, [appScreen, viewMode, station.id]);

  const enterGym = useCallback(() => {
    unlockGameAudio();
    setViewMode('browse');
    setAppScreen('gym');
  }, []);

  const goTitle = useCallback(() => {
    setViewMode('browse');
    setAppScreen('title');
    setOptionsOpen(false);
  }, []);

  const goHowto = useCallback(() => {
    setHowtoReturn(appScreen === 'howto' ? 'title' : appScreen);
    setAppScreen('howto');
    setOptionsOpen(false);
  }, [appScreen]);

  const leaveHowto = useCallback(() => {
    setAppScreen(howtoReturn === 'gym' ? 'gym' : 'title');
  }, [howtoReturn]);

  const goNext = useCallback(() => {
    if (viewMode !== 'browse') return;
    setStationIndex((i) => (i + 1) % GYM_STATIONS.length);
  }, [viewMode]);

  const goPrev = useCallback(() => {
    if (viewMode !== 'browse') return;
    setStationIndex((i) => (i - 1 + GYM_STATIONS.length) % GYM_STATIONS.length);
  }, [viewMode]);

  const selectStation = useCallback(() => {
    unlockGameAudio();
    if (PLAY_STATIONS.has(station.id)) {
      setViewMode('play');
    }
  }, [station.id]);

  const backToBrowse = useCallback(() => {
    setViewMode('browse');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (optionsOpen) return;

      if (appScreen === 'title') {
        if (e.key === 'Enter') enterGym();
        return;
      }

      if (appScreen === 'howto') {
        if (e.key === 'Escape') leaveHowto();
        if (e.key === 'Enter') enterGym();
        return;
      }

      if (viewMode === 'browse') {
        if (e.key === 'ArrowRight') goNext();
        if (e.key === 'ArrowLeft') goPrev();
        if (e.key === 'Enter') selectStation();
        if (e.key === 'Escape') goTitle();
      }
      if (viewMode === 'play' && e.key === 'Escape') backToBrowse();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    appScreen,
    viewMode,
    goNext,
    goPrev,
    selectStation,
    backToBrowse,
    optionsOpen,
    enterGym,
    goTitle,
    leaveHowto,
  ]);

  if (appScreen === 'title') {
    return (
      <>
        <TitleScreen
          onEnterGym={enterGym}
          onHowToPlay={goHowto}
          onOptions={() => {
            unlockGameAudio();
            setOptionsOpen(true);
          }}
        />
        <OptionsPanel open={optionsOpen} onClose={() => setOptionsOpen(false)} />
      </>
    );
  }

  if (appScreen === 'howto') {
    return (
      <InstructionsScreen
        onBack={leaveHowto}
        onEnterGym={enterGym}
      />
    );
  }

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
          <div className="gym-top-left">
            <button type="button" className="gym-menu-btn" onClick={goTitle} aria-label="Main menu">
              Menu
            </button>
            <button
              type="button"
              className="gym-options-btn"
              onClick={() => {
                unlockGameAudio();
                setOptionsOpen(true);
              }}
              aria-label="Options"
            >
              Options
            </button>
          </div>
          <div className="gym-station-title">
            <span className="gym-station-name">{station.name}</span>
          </div>
          <button type="button" className="gym-howto-btn" onClick={goHowto}>
            Help
          </button>
        </header>

        <button type="button" className="gym-arrow gym-arrow-left" onClick={goPrev} aria-label="Previous station">
          <ChevronLeft size={32} />
        </button>
        <button type="button" className="gym-arrow gym-arrow-right" onClick={goNext} aria-label="Next station">
          <ChevronRight size={32} />
        </button>

        <footer className="gym-bottom">
          <div className="station-dots" role="tablist" aria-label="Training stations">
            {GYM_STATIONS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === stationIndex}
                className={`station-dot ${i === stationIndex ? 'active' : ''}`}
                onClick={() => setStationIndex(i)}
                title={s.name}
              >
                <span className="station-dot-label">{s.shortLabel}</span>
              </button>
            ))}
          </div>
          <p className="gym-hint">{station.description}</p>
          <button type="button" className="gym-select-btn" onClick={selectStation}>
            {station.cta}
          </button>
        </footer>
      </div>

      <OptionsPanel open={optionsOpen} onClose={() => setOptionsOpen(false)} />
    </div>
  );
}
