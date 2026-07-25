import { useCallback, useRef, useState } from 'react';
import {
  ALL_FACE_DAMAGES,
  type FaceDamageId,
  pickRandomFaceDamage,
  randomDamageThreshold,
} from './faceDamage';

/**
 * Track ring hits and apply random bruises/cuts on the HUD damage meter.
 * Every 3–6 landed punches, apply one unused mark until the meter hits 100%.
 * Holds at full — no auto-reset.
 */
export function useFaceDamage() {
  const [damages, setDamages] = useState<FaceDamageId[]>([]);
  const hitsUntilDamageRef = useRef(0);
  const thresholdRef = useRef(randomDamageThreshold());

  const registerHit = useCallback(() => {
    hitsUntilDamageRef.current += 1;
    if (hitsUntilDamageRef.current < thresholdRef.current) return;

    hitsUntilDamageRef.current = 0;
    thresholdRef.current = randomDamageThreshold();

    setDamages((prev) => {
      if (prev.length >= ALL_FACE_DAMAGES.length) return prev;
      const nextDamage = pickRandomFaceDamage(prev);
      if (!nextDamage) return prev;
      return [...prev, nextDamage];
    });
  }, []);

  const resetDamages = useCallback(() => {
    hitsUntilDamageRef.current = 0;
    thresholdRef.current = randomDamageThreshold();
    setDamages([]);
  }, []);

  return { damages, registerHit, resetDamages };
}
