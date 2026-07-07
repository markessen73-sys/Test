import { useCallback, useRef, useState } from 'react';
import {
  ALL_FACE_DAMAGES,
  type FaceDamageId,
  pickRandomFaceDamage,
  randomDamageThreshold,
} from './faceDamage';

/** Track ring hits and apply random face injuries every 3–6 landed punches. */
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
      const nextDamage = pickRandomFaceDamage(prev);
      if (!nextDamage) return prev;

      const next = [...prev, nextDamage];
      if (next.length >= ALL_FACE_DAMAGES.length) {
        // All injuries applied — reset for now (game-end flow TBD).
        return [];
      }
      return next;
    });
  }, []);

  const resetDamages = useCallback(() => {
    hitsUntilDamageRef.current = 0;
    thresholdRef.current = randomDamageThreshold();
    setDamages([]);
  }, []);

  return { damages, registerHit, resetDamages };
}
