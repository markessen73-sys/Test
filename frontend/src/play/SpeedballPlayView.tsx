import { useCallback, useEffect, useRef, useState } from 'react';
import { SpeedballPlayScene } from './SpeedballPlayScene';
import { GlovesPlayShell } from './GlovesPlayShell';
import { useElasticGloves } from './useElasticGloves';
import { isKnuckleOnSpeedball } from './speedballZoneGrid';
import { playPunchSfx, preloadPunchSfx } from './playPunchSfx';
import type { PunchImpact } from './punchImpact';
import type { GloveId, GlovePosition } from '../types/game';
import type { HitZoneCorners } from './targetZone';

interface SpeedballPlayViewProps {
  onBack: () => void;
}

const FALLBACK_ZONE: HitZoneCorners = [
  { x: 0.38, y: 0.14 },
  { x: 0.62, y: 0.14 },
  { x: 0.64, y: 0.36 },
  { x: 0.36, y: 0.36 },
];

export function SpeedballPlayView({ onBack }: SpeedballPlayViewProps) {
  const [punchCount, setPunchCount] = useState(0);
  const [impacts, setImpacts] = useState<PunchImpact[]>([]);
  const impactIdRef = useRef(0);
  const targetZoneOffsetRef = useRef<GlovePosition>({ x: 0, y: 0 });
  const targetZoneCornersRef = useRef<HitZoneCorners>(FALLBACK_ZONE);

  const onPunch = useCallback((glove: GloveId, knuckle: GlovePosition) => {
    playPunchSfx('speedball');
    setPunchCount((c) => c + 1);
    impactIdRef.current += 1;
    setImpacts((prev) => [
      ...prev,
      { id: impactIdRef.current, glove, knuckle, time: performance.now() },
    ]);
  }, []);

  useEffect(() => {
    preloadPunchSfx('speedball');
  }, []);

  const isKnuckleOnTarget = useCallback(
    (knuckle: GlovePosition, _zoneOffset: GlovePosition) =>
      isKnuckleOnSpeedball(knuckle, targetZoneCornersRef.current),
    []
  );

  const gloves = useElasticGloves({
    onPunch,
    targetZoneOffsetRef,
    isKnuckleOnTarget,
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
      canvas={<SpeedballPlayScene impacts={impacts} speedballZoneCornersRef={targetZoneCornersRef} />}
      {...gloves}
    />
  );
}
