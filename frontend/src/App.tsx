import { BuildFaceApp } from './build-face/BuildFaceApp';
import { GymApp } from './GymApp';
import { CharacterProvider } from './play/face/CharacterContext';
import { useBackgroundMusic } from './useBackgroundMusic';

function App() {
  useBackgroundMusic();

  const params = new URLSearchParams(window.location.search);
  const builder = params.get('builder');

  if (builder === 'face' || builder === 'character') {
    return (
      <div className="app">
        <BuildFaceApp />
      </div>
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
