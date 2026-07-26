import { useCallback, useEffect, useRef, useState } from 'react';
import { BoboDollPlayScene } from './BoboDollPlayScene';
import { GlovesPlayShell } from './GlovesPlayShell';
import { useElasticGloves } from './useElasticGloves';
import { isKnuckleOnBoboDoll } from './boboZoneGrid';
import { playPunchSfx, preloadPunchSfx } from './playPunchSfx';
import { useFaceDamage } from './face/useFaceDamage';
import { OpponentDamageHud } from './face/OpponentDamageHud';
import { KnockoutBellOverlay } from './face/KnockoutBellOverlay';
import { useCharacter } from './face/CharacterContext';
import { loadBoboClownFaceAssets } from './face/renderDamagedFace';
import type { PunchImpact } from './punchImpact';
import type { GloveId, GlovePosition } from '../types/game';

interface BoboDollPlayViewProps {
  onBack: () => void;
}

export function BoboDollPlayView({ onBack }: BoboDollPlayViewProps) {
  const { character } = useCharacter();
  const [punchCount, setPunchCount] = useState(0);
  const [impacts, setImpacts] = useState<PunchImpact[]>([]);
  const impactIdRef = useRef(0);
  const targetZoneOffsetRef = useRef<GlovePosition>({ x: 0, y: 0 });
  const {
    stage: damageStage,
    knockedOut,
    registerHit: registerFaceHit,
    resetDamages,
  } = useFaceDamage();

  const onPunch = useCallback(
    (glove: GloveId, knuckle: GlovePosition) => {
      playPunchSfx('bobo-doll');
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
    preloadPunchSfx('bobo-doll');
  }, []);

  const gloves = useElasticGloves({
    onPunch,
    targetZoneOffsetRef,
    isKnuckleOnTarget: isKnuckleOnBoboDoll,
  });

  const loadClownHud = useCallback(
    () => loadBoboClownFaceAssets(character),
    [character]
  );

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
      hudExtra={
        <>
          <KnockoutBellOverlay active={knockedOut} onRestart={onRestart} />
          <OpponentDamageHud stage={damageStage} loadAssets={loadClownHud} />
        </>
      }
      canvas={
        <BoboDollPlayScene
          impacts={impacts}
          boboZoneOffsetRef={targetZoneOffsetRef}
          knockedOut={knockedOut}
        />
      }
      {...gloves}
    />
  );
}
