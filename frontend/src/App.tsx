import { GymApp } from './GymApp';
import { CharacterBuilderApp } from './CharacterBuilderApp';
import { CharacterProvider } from './play/face/CharacterContext';
import { useBackgroundMusic } from './useBackgroundMusic';

function useCharacterBuilderRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('builder') === 'character';
}

function App() {
  useBackgroundMusic();
  const builderMode = useCharacterBuilderRoute();

  if (builderMode) {
    return (
      <div className="app">
        <CharacterBuilderApp />
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
