import { useCallback, useRef, useState } from 'react';
import {
  DAMAGE_METER_STEPS,
  damagePercentForStage,
  randomDamageThreshold,
} from './faceDamage';

/** Optional `?damageStage=0..10` to preview a meter step without punching. */
function initialStageFromUrl(): number {
  if (typeof window === 'undefined') return 0;
  const raw = new URLSearchParams(window.location.search).get('damageStage');
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(DAMAGE_METER_STEPS, Math.round(n)));
}

/**
 * Track ring hits and advance the damage meter in 10% steps.
 * Every 3–6 landed punches → +10%, up to 100% (KO).
 * Holds at full — no auto-reset.
 */
export function useFaceDamage() {
  const [stage, setStage] = useState(initialStageFromUrl);
  const hitsUntilDamageRef = useRef(0);
  const thresholdRef = useRef(randomDamageThreshold());

  const registerHit = useCallback(() => {
    hitsUntilDamageRef.current += 1;
    if (hitsUntilDamageRef.current < thresholdRef.current) return;

    hitsUntilDamageRef.current = 0;
    thresholdRef.current = randomDamageThreshold();

    setStage((prev) => {
      if (prev >= DAMAGE_METER_STEPS) return prev;
      return prev + 1;
    });
  }, []);

  const resetDamages = useCallback(() => {
    hitsUntilDamageRef.current = 0;
    thresholdRef.current = randomDamageThreshold();
    setStage(0);
  }, []);

  return {
    stage,
    percent: damagePercentForStage(stage),
    knockedOut: stage >= DAMAGE_METER_STEPS,
    registerHit,
    resetDamages,
  };
}
