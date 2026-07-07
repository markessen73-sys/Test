import { useEffect } from 'react';
import { startBackgroundMusic } from './backgroundMusic';

/** Unlock and start quiet gym ambience on first user gesture (title screen onward). */
export function useBackgroundMusic(): void {
  useEffect(() => {
    const unlock = () => startBackgroundMusic();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
}
