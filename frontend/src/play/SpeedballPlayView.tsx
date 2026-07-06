import { useCallback, useRef, useState } from 'react';
import { SpeedballPlayScene } from './SpeedballPlayScene';
import { GlovesPlayShell } from './GlovesPlayShell';
import { useElasticGloves } from './useElasticGloves';
import { isKnuckleOnSpeedball } from './speedballZoneGrid';
import type { PunchImpact } from './punchImpact';
import type { GloveId, GlovePosition } from '../types/game';

interface SpeedballPlayViewProps {
  onBack: () => void;
}

export function SpeedballPlayView({ onBack }: SpeedballPlayViewProps) {
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
    isKnuckleOnTarget: isKnuckleOnSpeedball,
  });

  return (
    <GlovesPlayShell
      onBack={onBack}
      title="🏐 Speedball"
      punchCount={punchCount}
      hint={
        <>
          <strong>Upward</strong> drags leave a vapour trail; release on the speedball while still moving to score.
        </>
      }
      canvas={<SpeedballPlayScene impacts={impacts} speedballZoneOffsetRef={targetZoneOffsetRef} />}
      {...gloves}
    />
  );
}
