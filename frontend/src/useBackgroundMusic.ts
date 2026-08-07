import { useEffect } from 'react';
import { unlockGameAudio } from './gameAudio';

/** Keep gym ambience and punch SFX unlocked across gestures and tab focus. */
export function useBackgroundMusic(): void {
  useEffect(() => {
    const unlock = () => unlockGameAudio();

    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('touchstart', unlock, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') unlock();
    });

    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      window.removeEventListener('touchstart', unlock, { capture: true });
    };
  }, []);
}
