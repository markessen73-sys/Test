import { useEffect, useState } from 'react';
import { CreateStep } from './steps/CreateStep';
import { GymStep } from './steps/GymStep';
import type { AppStep } from './types/game';

// Demo face for ?preview=gym — lets you explore the gym without creating a caricature
const DEMO_FACE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
      <rect fill="#FFD90F" width="256" height="256"/>
      <ellipse cx="128" cy="140" rx="90" ry="100" fill="#FFE566"/>
      <circle cx="88" cy="120" r="22" fill="white"/><circle cx="88" cy="122" r="10" fill="#333"/>
      <circle cx="168" cy="120" r="22" fill="white"/><circle cx="168" cy="122" r="10" fill="#333"/>
      <ellipse cx="128" cy="175" rx="30" ry="12" fill="#8B4513"/>
    </svg>`
  );

function App() {
  const [step, setStep] = useState<AppStep>('create');
  const [caricatureUrl, setCaricatureUrl] = useState<string | null>(null);
  const [styleName, setStyleName] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('preview') === 'gym') {
      setCaricatureUrl(DEMO_FACE);
      setStyleName('Demo Fighter');
      setStep('gym');
    }
  }, []);

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
