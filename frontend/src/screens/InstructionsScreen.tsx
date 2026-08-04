interface InstructionsScreenProps {
  onBack: () => void;
  onEnterGym: () => void;
}

const STEPS = [
  {
    title: 'Pick your kit',
    body: 'Open Options to choose gloves and a boxer face. Power changes how hard each punch lands.',
  },
  {
    title: 'Choose a station',
    body: 'Swipe or use the arrows in the gym. Ring, speedball, heavy bag, and bobo each train a different feel.',
  },
  {
    title: 'Glove up',
    body: 'Drag both gloves with your fingers or mouse. Snap a punch into the target — timing and reach matter.',
  },
  {
    title: 'Finish the round',
    body: 'In the ring, fill the damage meter to ring the bell. Back returns you to the gym floor.',
  },
] as const;

/**
 * Simple how-to page — one job per section, no clutter.
 */
export function InstructionsScreen({ onBack, onEnterGym }: InstructionsScreenProps) {
  return (
    <div className="howto-screen" role="main" aria-label="How to play">
      <header className="howto-top">
        <button type="button" className="gym-back-btn" onClick={onBack}>
          ← Back
        </button>
        <h1 className="howto-title">How to Play</h1>
        <span className="howto-top-spacer" aria-hidden="true" />
      </header>

      <div className="howto-body">
        <p className="howto-lead">Mick keeps it simple. Show up, hit clean, leave better.</p>

        <ol className="howto-steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="howto-step">
              <span className="howto-step-num">{i + 1}</span>
              <div className="howto-step-copy">
                <h2 className="howto-step-title">{step.title}</h2>
                <p className="howto-step-body">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="howto-controls">
          <h2 className="howto-controls-title">Controls</h2>
          <ul className="howto-controls-list">
            <li>
              <strong>Touch / mouse</strong> — grab each glove and punch the target
            </li>
            <li>
              <strong>← →</strong> — cycle gym stations
            </li>
            <li>
              <strong>Enter</strong> — start the selected station
            </li>
            <li>
              <strong>Esc</strong> — leave a station or close a menu
            </li>
          </ul>
        </div>

        <button type="button" className="title-btn title-btn-primary howto-cta" onClick={onEnterGym}>
          Enter Gym
        </button>
      </div>
    </div>
  );
}
