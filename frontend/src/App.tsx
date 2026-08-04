import type { ReactNode } from 'react';
import { FaceCaptureApp } from './face-capture/FaceCaptureApp';
import { GymApp } from './GymApp';
import { CharacterProvider } from './play/face/CharacterContext';
import { GloveProvider, useGlove } from './play/GloveContext';
import { useBackgroundMusic } from './useBackgroundMusic';

function AppShell({ children }: { children: ReactNode }) {
  const { silentFilmMode } = useGlove();
  return (
    <div className={`app ${silentFilmMode ? 'film-silent-era' : ''}`}>
      {children}
      {silentFilmMode && (
        <>
          <div className="film-grain-overlay" aria-hidden />
          <div className="film-scratch-overlay" aria-hidden />
          <div className="film-vignette-overlay" aria-hidden />
        </>
      )}
    </div>
  );
}

function App() {
  useBackgroundMusic();

  const params = new URLSearchParams(window.location.search);
  const builder = params.get('builder');

  if (builder === 'face' || builder === 'character') {
    return (
      <CharacterProvider>
        <GloveProvider>
          <AppShell>
            <FaceCaptureApp />
          </AppShell>
        </GloveProvider>
      </CharacterProvider>
    );
  }

  return (
    <CharacterProvider>
      <GloveProvider>
        <AppShell>
          <GymApp />
        </AppShell>
      </GloveProvider>
    </CharacterProvider>
  );
}

export default App;
