import { useCallback, useEffect, useRef, useState } from 'react';
import { HeavyBagPlayScene } from './HeavyBagPlayScene';
import { GlovesPlayShell } from './GlovesPlayShell';
import { useElasticGloves } from './useElasticGloves';
import { isGloveTopOnPunchBag } from './gloveZoneGrid';
import { playPunchSfx, preloadPunchSfx } from './playPunchSfx';
import type { BagPunchImpact } from './bagImpact';
import type { GloveId, GlovePosition } from '../types/game';

interface HeavyBagPlayViewProps {
  onBack: () => void;
}

export function HeavyBagPlayView({ onBack }: HeavyBagPlayViewProps) {
  const [punchCount, setPunchCount] = useState(0);
  const [impacts, setImpacts] = useState<BagPunchImpact[]>([]);
  const impactIdRef = useRef(0);
  const targetZoneOffsetRef = useRef<GlovePosition>({ x: 0, y: 0 });

  const onPunch = useCallback((glove: GloveId, knuckle: GlovePosition) => {
    playPunchSfx('heavy-bag');
    setPunchCount((c) => c + 1);
    impactIdRef.current += 1;
    setImpacts((prev) => [
      ...prev,
      { id: impactIdRef.current, glove, knuckle, time: performance.now() },
    ]);
  }, []);

  useEffect(() => {
    preloadPunchSfx('heavy-bag');
  }, []);

  const gloves = useElasticGloves({
    onPunch,
    targetZoneOffsetRef,
    isKnuckleOnTarget: isGloveTopOnPunchBag,
  });

  return (
    <GlovesPlayShell
      onBack={onBack}
      title="🎯 Heavy Bag"
      punchCount={punchCount}
      hint={
        <>
          <strong>Upward</strong> drags leave a vapour trail while you hold; release on the bag while still moving to score.
        </>
      }
      canvas={<HeavyBagPlayScene impacts={impacts} bagZoneOffsetRef={targetZoneOffsetRef} />}
      {...gloves}
    />
  );
}
