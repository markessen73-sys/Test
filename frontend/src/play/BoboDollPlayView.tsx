import { useCallback, useRef, useState } from 'react';
import { BoboDollPlayScene } from './BoboDollPlayScene';
import { GlovesPlayShell } from './GlovesPlayShell';
import { useElasticGloves } from './useElasticGloves';
import { isKnuckleOnBoboDoll } from './boboZoneGrid';
import type { PunchImpact } from './punchImpact';
import type { GloveId, GlovePosition } from '../types/game';

interface BoboDollPlayViewProps {
  onBack: () => void;
}

export function BoboDollPlayView({ onBack }: BoboDollPlayViewProps) {
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
    isKnuckleOnTarget: isKnuckleOnBoboDoll,
  });

  return (
    <GlovesPlayShell
      onBack={onBack}
      title="🤡 Bobo Doll"
      punchCount={punchCount}
      hint={
        <>
          <strong>Upward</strong> drags leave a vapour trail; release on the bobo while still moving to rock it.
        </>
      }
      canvas={<BoboDollPlayScene impacts={impacts} boboZoneOffsetRef={targetZoneOffsetRef} />}
      {...gloves}
    />
  );
}
