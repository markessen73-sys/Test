import { FaceCaptureApp } from './face-capture/FaceCaptureApp';
import { GymApp } from './GymApp';
import { CharacterProvider } from './play/face/CharacterContext';
import { useBackgroundMusic } from './useBackgroundMusic';

function App() {
  useBackgroundMusic();

  const params = new URLSearchParams(window.location.search);
  const builder = params.get('builder');

  if (builder === 'face' || builder === 'character') {
    return (
      <CharacterProvider>
        <div className="app">
          <FaceCaptureApp />
        </div>
      </CharacterProvider>
    );
  }

  return (
    <CharacterProvider>
      <div className="app">
        <GymApp />
      </div>
    </CharacterProvider>
  );
}

export default App;
