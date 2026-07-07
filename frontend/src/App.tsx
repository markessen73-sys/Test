import { GymApp } from './GymApp';
import { useBackgroundMusic } from './useBackgroundMusic';

function App() {
  useBackgroundMusic();

  return (
    <div className="app">
      <GymApp />
    </div>
  );
}

export default App;
