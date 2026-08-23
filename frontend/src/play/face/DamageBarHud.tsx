/**
 * Top-right damage meter without a face portrait (heavy bag Polaroid mode).
 */
interface DamageBarHudProps {
  /** Damage meter stage 0–10 (each step = 10%). */
  stage: number
}

export function DamageBarHud({ stage }: DamageBarHudProps) {
  const pct = Math.max(0, Math.min(100, stage * 10))
  const knockedOut = pct >= 100

  return (
    <aside className="play-damage-hud play-damage-bar" aria-label={`Damage meter ${pct} percent`}>
      <div className="play-damage-hud-frame play-damage-bar-frame">
        <div className="play-damage-hud-meter">
          <div className="play-damage-hud-meter-label">
            <span>{knockedOut ? 'K.O.' : 'DAMAGE'}</span>
            <span>{pct}%</span>
          </div>
          <div className="play-damage-hud-meter-track play-damage-bar-track">
            <div
              className="play-damage-hud-meter-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  )
}
