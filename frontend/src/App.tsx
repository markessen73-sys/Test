import { useState } from 'react';
import { CreateStep } from './steps/CreateStep';
import { FightStep } from './steps/FightStep';
import { GymStep } from './steps/GymStep';
import type { AppStep, EquipmentType } from './types/game';

function App() {
  const [step, setStep] = useState<AppStep>('create');
  const [caricatureUrl, setCaricatureUrl] = useState<string | null>(null);
  const [styleName, setStyleName] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<EquipmentType | null>(null);

  const handleCreateComplete = (url: string, style: string) => {
    setCaricatureUrl(url);
    setStyleName(style);
    setStep('gym');
  };

  const handleEquipmentSelect = (eq: EquipmentType) => {
    setEquipment(eq);
    setStep('fight');
  };

  const handleRestart = () => {
    setStep('create');
    setCaricatureUrl(null);
    setStyleName(null);
    setEquipment(null);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <div className="logo-icon">🥊</div>
          <div>
            <h1>Caricature Boxing Gym</h1>
            <p>Upload → Caricature → Fight!</p>
          </div>
        </div>
        <nav className="step-nav">
          {(['create', 'gym', 'fight'] as AppStep[]).map((s, i) => (
            <span
              key={s}
              className={`step-nav-item ${step === s ? 'active' : ''} ${['create', 'gym', 'fight'].indexOf(step) > i ? 'done' : ''}`}
            >
              {i + 1}. {s === 'create' ? 'Create' : s === 'gym' ? 'Gym' : 'Fight'}
            </span>
          ))}
        </nav>
      </header>

      <main className={`main ${step === 'fight' ? 'main-fight' : ''}`}>
        {step === 'create' && <CreateStep onComplete={handleCreateComplete} />}
        {step === 'gym' && caricatureUrl && styleName && (
          <GymStep
            caricatureUrl={caricatureUrl}
            styleName={styleName}
            onSelect={handleEquipmentSelect}
            onBack={() => setStep('create')}
          />
        )}
        {step === 'fight' && caricatureUrl && equipment && (
          <FightStep
            caricatureUrl={caricatureUrl}
            equipment={equipment}
            onBack={() => setStep('gym')}
            onRestart={handleRestart}
          />
        )}
      </main>
    </div>
  );
}

export default App;
