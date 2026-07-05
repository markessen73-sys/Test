import { useState } from 'react';
import { CreateStep } from './steps/CreateStep';
import { GymStep } from './steps/GymStep';
import type { AppStep } from './types/game';

function App() {
  const [step, setStep] = useState<AppStep>('create');
  const [caricatureUrl, setCaricatureUrl] = useState<string | null>(null);
  const [styleName, setStyleName] = useState<string | null>(null);

  const handleCreateComplete = (url: string, style: string) => {
    setCaricatureUrl(url);
    setStyleName(style);
    setStep('gym');
  };

  const handleRestart = () => {
    setStep('create');
    setCaricatureUrl(null);
    setStyleName(null);
  };

  return (
    <div className="app">
      {step === 'create' && (
        <>
          <header className="header">
            <div className="logo">
              <div className="logo-icon">🥊</div>
              <div>
                <h1>Mickey's Caricature Gym</h1>
                <p>Create your fighter → enter the gym</p>
              </div>
            </div>
          </header>
          <main className="main">
            <CreateStep onComplete={handleCreateComplete} />
          </main>
        </>
      )}

      {step === 'gym' && caricatureUrl && styleName && (
        <main className="main main-gym">
          <GymStep
            caricatureUrl={caricatureUrl}
            styleName={styleName}
            onBack={() => setStep('create')}
            onRestart={handleRestart}
          />
        </main>
      )}
    </div>
  );
}

export default App;
