import { useCallback, useEffect, useRef, useState } from 'react';
import { RingPlayScene } from './RingPlayScene';
import { GlovesPlayShell } from './GlovesPlayShell';
import { useElasticGloves } from './useElasticGloves';
import { isKnuckleOnSparringPartner } from './ringZoneGrid';
import { playPunchSfx, preloadPunchSfx } from './playPunchSfx';
import { useFaceDamage } from './face/useFaceDamage';
import { OpponentDamageHud } from './face/OpponentDamageHud';
import { KnockoutBellOverlay } from './face/KnockoutBellOverlay';
import { ALL_FACE_DAMAGES } from './face/faceDamage';
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
  const {
    damages: faceDamages,
    registerHit: registerFaceHit,
    resetDamages,
  } = useFaceDamage();
  const knockedOut = faceDamages.length >= ALL_FACE_DAMAGES.length;

  const onPunch = useCallback(
    (glove: GloveId, knuckle: GlovePosition) => {
      playPunchSfx('ring');
      setPunchCount((c) => c + 1);
      impactIdRef.current += 1;
      setImpacts((prev) => [
        ...prev,
        { id: impactIdRef.current, glove, knuckle, time: performance.now() },
      ]);
      registerFaceHit();
    },
    [registerFaceHit]
  );

  const onRestart = useCallback(() => {
    resetDamages();
    setPunchCount(0);
    setImpacts([]);
    impactIdRef.current = 0;
  }, [resetDamages]);

  useEffect(() => {
    preloadPunchSfx('ring');
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
      hudExtra={
        <>
          <KnockoutBellOverlay active={knockedOut} onRestart={onRestart} />
          <OpponentDamageHud damages={faceDamages} />
        </>
      }
      canvas={
        <RingPlayScene
          impacts={impacts}
          ringZoneOffsetRef={targetZoneOffsetRef}
          knockedOut={knockedOut}
        />
      }
      {...gloves}
    />
  );
}
