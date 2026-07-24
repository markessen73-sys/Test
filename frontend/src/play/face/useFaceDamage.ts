import { useCallback, useRef, useState } from 'react';
import {
  ALL_FACE_DAMAGES,
  type FaceDamageId,
  pickRandomFaceDamage,
  randomDamageThreshold,
} from './faceDamage';

/**
 * Track ring hits and apply random face injuries.
 * Instructions: randomly every 3–6 landed punches, apply one unused damage
 * (cauliflower L/R ear, black L/R eye, forehead bandage,
 * broken nose, swollen bottom lip, missing tooth). After all injuries,
 * reset the face (game-end flow TBD).
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
      // All seven already showing — next threshold clears the face.
      if (prev.length >= ALL_FACE_DAMAGES.length) {
        return [];
      }

      const nextDamage = pickRandomFaceDamage(prev);
      if (!nextDamage) return [];
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
