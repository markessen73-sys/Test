import { FaceCaptureApp } from './face-capture/FaceCaptureApp';
import { GymApp } from './GymApp';
import { CharacterProvider } from './play/face/CharacterContext';
import { GloveProvider } from './play/GloveContext';
import { useBackgroundMusic } from './useBackgroundMusic';

function App() {
  useBackgroundMusic();

  const params = new URLSearchParams(window.location.search);
  const builder = params.get('builder');

  if (builder === 'face' || builder === 'character') {
    return (
      <CharacterProvider>
        <GloveProvider>
          <div className="app">
            <FaceCaptureApp />
          </div>
        </GloveProvider>
      </CharacterProvider>
    );
  }

  return (
    <CharacterProvider>
      <GloveProvider>
        <div className="app">
          <GymApp />
        </div>
      </GloveProvider>
    </CharacterProvider>
  );
}

export default App;
