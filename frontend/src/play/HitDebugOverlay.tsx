import { bagHitZoneOutline } from './gloveZoneGrid';

/** White outline showing the bag hit zone only. Impact dots live on each glove. */
export function HitDebugOverlay() {
  const bagPoints = bagHitZoneOutline()
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  return (
    <svg className="hit-debug-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
      <polygon className="hit-debug-bag-zone" points={bagPoints} />
    </svg>
  );
}
