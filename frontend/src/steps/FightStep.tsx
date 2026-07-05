import { useCallback, useEffect, useRef, useState } from 'react';
import { FightScene } from '../gym/FightScene';
import { EQUIPMENT, type EquipmentType, type PunchType } from '../types/game';

const PUNCH_LABELS: Record<PunchType, string> = {
  jab: 'JAB!',
  cross: 'CROSS!',
  hook: 'HOOK!',
  uppercut: 'UPPERCUT!',
  body: 'BODY SHOT!',
};

const PUNCH_HINTS: Record<PunchType, string> = {
  jab: 'Face squishes sideways',
  cross: 'Black eye incoming',
  hook: 'Stars and squash',
  uppercut: 'Face stretches up — dizzy!',
  body: 'Tongue out, red cheeks',
};

interface FightStepProps {
  caricatureUrl: string;
  equipment: EquipmentType;
  onBack: () => void;
  onRestart: () => void;
}

export function FightStep({ caricatureUrl, equipment, onBack, onRestart }: FightStepProps) {
  const [lastPunch, setLastPunch] = useState<PunchType | null>(null);
  const [combo, setCombo] = useState(0);
  const [hitCount, setHitCount] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const comboTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const equipmentInfo = EQUIPMENT.find((e) => e.id === equipment)!;

  const handlePunch = useCallback((type: PunchType) => {
    setLastPunch(type);
    setHitCount((c) => c + 1);
    setCombo((c) => c + 1);
    setFlash(PUNCH_LABELS[type]);

    clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => {
      setCombo(0);
      setLastPunch(null);
    }, 1200);

    setTimeout(() => setFlash(null), 600);
  }, []);

  useEffect(() => () => clearTimeout(comboTimer.current), []);

  return (
    <div className="fight-container">
      <div className="fight-hud">
        <div className="fight-hud-left">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
            ← Gym
          </button>
          <span className="fight-equipment-name">{equipmentInfo.emoji} {equipmentInfo.name}</span>
        </div>
        <div className="fight-hud-center">
          {flash && <div className="punch-flash">{flash}</div>}
          {combo > 1 && <div className="combo-counter">{combo}x COMBO!</div>}
        </div>
        <div className="fight-hud-right">
          <span className="hit-counter">{hitCount} hits</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRestart}>
            New fighter
          </button>
        </div>
      </div>

      <div className="fight-canvas-wrap">
        <FightScene
          equipment={equipment}
          caricatureUrl={caricatureUrl}
          onPunch={handlePunch}
          lastPunch={lastPunch}
          combo={combo}
        />
      </div>

      <div className="fight-controls">
        <p className="fight-hint">
          <strong>Click the equipment</strong> to punch! Different hit zones trigger different punches:
        </p>
        <div className="punch-legend">
          {(['jab', 'hook', 'uppercut', 'body'] as PunchType[]).map((p) => (
            <span key={p} className="punch-tag">
              {PUNCH_LABELS[p]} <em>{PUNCH_HINTS[p]}</em>
            </span>
          ))}
        </div>
        {lastPunch && (
          <p className="reaction-hint">
            Reaction: {PUNCH_HINTS[lastPunch]}
          </p>
        )}
      </div>
    </div>
  );
}
