import { EQUIPMENT, type EquipmentType } from '../types/game';

interface GymStepProps {
  caricatureUrl: string;
  styleName: string;
  onSelect: (equipment: EquipmentType) => void;
  onBack: () => void;
}

export function GymStep({ caricatureUrl, styleName, onSelect, onBack }: GymStepProps) {
  return (
    <>
      <div className="step-header">
        <span className="step-label">Step 2 of 3</span>
        <h2>Pick your opponent</h2>
        <p>Choose which boxing equipment gets your caricature face</p>
      </div>

      <div className="fighter-preview">
        <img src={caricatureUrl} alt="Your fighter" className="fighter-thumb" />
        <div>
          <strong>{styleName} fighter</strong>
          <p>Ready to mount on gym equipment</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Change photo
        </button>
      </div>

      <div className="equipment-grid">
        {EQUIPMENT.map((eq) => (
          <button
            key={eq.id}
            type="button"
            className="equipment-card"
            onClick={() => onSelect(eq.id)}
          >
            <span className="equipment-emoji">{eq.emoji}</span>
            <h3>{eq.name}</h3>
            <p>{eq.description}</p>
            <span className="equipment-cta">Fight this →</span>
          </button>
        ))}
      </div>
    </>
  );
}
