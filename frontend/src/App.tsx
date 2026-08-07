import type { ReactNode } from 'react';
import { FaceCaptureApp } from './face-capture/FaceCaptureApp';
import { GymApp } from './GymApp';
import { CharacterProvider } from './play/face/CharacterContext';
import { BodyProvider } from './play/BodyContext';
import { GloveProvider, useGlove } from './play/GloveContext';
import { useBackgroundMusic } from './useBackgroundMusic';

function AppShell({ children }: { children: ReactNode }) {
  const { silentFilmMode } = useGlove();
  return <div className={`app ${silentFilmMode ? 'film-silent-era' : ''}`}>{children}</div>;
}

function App() {
  useBackgroundMusic();

  const params = new URLSearchParams(window.location.search);
  const builder = params.get('builder');

  if (builder === 'face' || builder === 'character') {
    return (
      <CharacterProvider>
        <GloveProvider>
          <BodyProvider>
            <AppShell>
              <FaceCaptureApp />
            </AppShell>
          </BodyProvider>
        </GloveProvider>
      </CharacterProvider>
    );
  }

  return (
    <CharacterProvider>
      <GloveProvider>
        <BodyProvider>
          <AppShell>
            <GymApp />
          </AppShell>
        </BodyProvider>
      </GloveProvider>
    </CharacterProvider>
  );
}

export default App;
