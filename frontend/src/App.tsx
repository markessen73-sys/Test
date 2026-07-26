import { GymApp } from './GymApp';
import { CharacterProvider } from './play/face/CharacterContext';
import { useBackgroundMusic } from './useBackgroundMusic';

function App() {
  useBackgroundMusic();

  return (
    <CharacterProvider>
      <div className="app">
        <GymApp />
      </div>
    </CharacterProvider>
  );
}

export default App;
