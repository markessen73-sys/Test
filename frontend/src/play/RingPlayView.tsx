import { useCallback, useRef, useState } from 'react';
import { RingPlayScene } from './RingPlayScene';
import { GlovesPlayShell } from './GlovesPlayShell';
import { useElasticGloves } from './useElasticGloves';
import { isKnuckleOnSparringPartner } from './ringZoneGrid';
import type { PunchImpact } from './punchImpact';
import type { GloveId, GlovePosition } from '../types/game';

interface RingPlayViewProps {
  onBack: () => void;
}

export function RingPlayView({ onBack }: RingPlayViewProps) {
  const [punchCount, setPunchCount] = useState(0);
  const [impacts, setImpacts] = useState<PunchImpact[]>([]);
  const impactIdRef = useRef(0);
  const targetZoneOffsetRef = useRef<GlovePosition>({ x: 0, y: 0 });

  const onPunch = useCallback((glove: GloveId, knuckle: GlovePosition) => {
    setPunchCount((c) => c + 1);
    impactIdRef.current += 1;
    setImpacts((prev) => [
      ...prev,
      { id: impactIdRef.current, glove, knuckle, time: performance.now() },
    ]);
  }, []);

  const gloves = useElasticGloves({
    onPunch,
    targetZoneOffsetRef,
    isKnuckleOnTarget: isKnuckleOnSparringPartner,
  });

  return (
    <GlovesPlayShell
      onBack={onBack}
      title="🥊 Mickey's Ring"
      punchCount={punchCount}
      hint={
        <>
          <strong>Upward</strong> drags leave a vapour trail; release on your opponent while still moving to land shots.
        </>
      }
      canvas={<RingPlayScene impacts={impacts} ringZoneOffsetRef={targetZoneOffsetRef} />}
      {...gloves}
    />
  );
}
