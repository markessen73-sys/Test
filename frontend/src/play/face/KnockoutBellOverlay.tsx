import { useEffect } from 'react';
import { assetUrl } from '../../assetUrl';
import { playBoxingBellSfx } from '../../gameAudio';

const BELL_SRC = assetUrl('/icons/boxing-bell.png');

interface KnockoutBellOverlayProps {
  active: boolean;
  onRestart: () => void;
}

/**
 * Top-left KO cue: boxing bell rings once when damage hits 100%, with Restart below.
 */
export function KnockoutBellOverlay({ active, onRestart }: KnockoutBellOverlayProps) {
  useEffect(() => {
    if (!active) return;
    playBoxingBellSfx();
  }, [active]);

  if (!active) return null;

  return (
    <aside className="play-ko-bell" aria-label="Knockout — round over">
      <img
        className="play-ko-bell-icon"
        src={BELL_SRC}
        alt=""
        width={96}
        height={96}
        draggable={false}
      />
      <button type="button" className="play-ko-restart" onClick={onRestart}>
        Restart
      </button>
    </aside>
  );
}
