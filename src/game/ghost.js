export class GhostRecorder {
  constructor() {
    this.points = [];
    this.lastStamp = 0;
  }

  record(timeMs, ship) {
    if (timeMs - this.lastStamp < 90) {
      return;
    }

    this.lastStamp = timeMs;
    this.points.push({
      t: Math.round(timeMs),
      x: Number(ship.x.toFixed(2)),
      y: Number(ship.y.toFixed(2)),
      r: Number(ship.rotation.toFixed(3)),
    });
  }

  export(challengeSeed, score, totalTimeMs) {
    return {
      challengeSeed,
      score,
      totalTimeMs,
      points: this.points,
    };
  }
}

export class GhostPlayback {
  constructor(points) {
    this.points = points || [];
    this.index = 0;
  }

  sample(timeMs) {
    if (this.points.length === 0) {
      return null;
    }

    while (this.index < this.points.length - 2 && this.points[this.index + 1].t < timeMs) {
      this.index += 1;
    }

    const current = this.points[this.index];
    const next = this.points[Math.min(this.index + 1, this.points.length - 1)];
    if (!current || !next) {
      return current || null;
    }

    const span = Math.max(next.t - current.t, 1);
    const alpha = Math.max(0, Math.min(1, (timeMs - current.t) / span));

    return {
      x: current.x + (next.x - current.x) * alpha,
      y: current.y + (next.y - current.y) * alpha,
      rotation: current.r + (next.r - current.r) * alpha,
    };
  }
}
