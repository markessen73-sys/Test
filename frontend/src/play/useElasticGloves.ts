import { useCallback, useEffect, useRef, useState } from 'react';
import type { GloveId, GloveState, TrailPoint, GlovePosition } from '../types/game';
import type { GloveTransform } from './skeleton/types';
import {
  ELASTIC_TENSION,
  fastMoveThresholdPxPerSec,
  FAST_MOVE_SPEED_LEVEL,
  GLOVE_ANCHORS,
  GLOVE_MIN_SEPARATION,
  GUARD_GLOVE_POSE,
  INWARD_GLOVE_TILT,
  springFromTension,
} from './elasticConfig';
import {
  clampGlovePosition,
  gloveFromScreenX,
  GRID_TOP_Y,
  LEFT_GLOVE_MAX_X,
  leftGloveZoneSrc,
  rightGloveZoneSrc,
  RIGHT_GLOVE_MIN_X,
} from './gloveZoneGrid';

const TRAIL_MAX = 48;
const TRAIL_FADE_MS = 520;
const PUNCH_COOLDOWN_MS = 220;
const AIM_FOLLOW_SPEED = 0.2;
const MOVE_AIM_NORM_SPEED = 0.35;

type HistPoint = { x: number; y: number; t: number; px: number; py: number };

interface GloveBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function makeGlove(pos: GlovePosition): GloveState {
  return { position: { ...pos }, trail: [], pointerId: null };
}

function normFromEvent(e: PointerEvent | React.PointerEvent, root: HTMLElement): GlovePosition {
  const rect = root.getBoundingClientRect();
  return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
}

function speedFromHistory(recent: HistPoint[]): number {
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const dt = last.t - first.t;
  return dt > 0 ? Math.hypot(last.px - first.px, last.py - first.py) / dt : 0;
}

function idleWobble(anchor: GlovePosition, side: GloveId, timeMs: number, amp: number): GlovePosition {
  const t = timeMs * 0.001;
  const phase = side === 'left' ? 0 : 1.1;
  return {
    x: anchor.x + Math.sin(t * 2.2 + phase) * amp,
    y: anchor.y + Math.sin(t * 1.7 + phase * 0.8) * amp * 0.85,
  };
}

function resolveOverlap(left: GloveBody, right: GloveBody, minDist: number) {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= minDist || dist < 1e-8) return;

  const nx = dx / dist;
  const ny = dy / dist;
  const push = (minDist - dist) * 0.5;
  left.x -= nx * push;
  left.y -= ny * push;
  right.x += nx * push;
  right.y += ny * push;

  const relVx = right.vx - left.vx;
  const relVy = right.vy - left.vy;
  const closing = relVx * nx + relVy * ny;
  if (closing < 0) {
    const impulse = closing * 0.5;
    left.vx += nx * impulse;
    left.vy += ny * impulse;
    right.vx -= nx * impulse;
    right.vy -= ny * impulse;
  }
}

function inwardAim(side: GloveId): number {
  return side === 'left' ? INWARD_GLOVE_TILT : -INWARD_GLOVE_TILT;
}

function aimFromVelocity(vx: number, vy: number, side: GloveId): number {
  const deg = Math.atan2(vy, vx) * (180 / Math.PI) + 90;
  return side === 'left' ? -deg : deg;
}

function lerpAngle(current: number, target: number, t: number): number {
  let delta = ((target - current + 180) % 360) - 180;
  if (delta < -180) delta += 360;
  return current + delta * t;
}

function gloveVisual(
  pos: GlovePosition,
  anchor: GlovePosition,
  side: GloveId,
  zoneArt: boolean,
  aimDeg: number
): GloveTransform {
  const stretch = Math.hypot(pos.x - anchor.x, pos.y - anchor.y);
  if (zoneArt) {
    return { rotate: aimDeg, scale: 1 + stretch * 0.06, scaleX: 1, skewX: 0, originY: '68%' };
  }
  const guard = GUARD_GLOVE_POSE[side];
  return {
    ...guard,
    rotate: aimDeg,
    scale: guard.scale + stretch * 0.12,
  };
}

export function useElasticGloves(onPunch: (glove: GloveId) => void) {
  const fastSpeedPx = fastMoveThresholdPxPerSec(FAST_MOVE_SPEED_LEVEL);

  const [left, setLeft] = useState<GloveState>(() => makeGlove(GLOVE_ANCHORS.left));
  const [right, setRight] = useState<GloveState>(() => makeGlove(GLOVE_ANCHORS.right));
  const [leftAim, setLeftAim] = useState(INWARD_GLOVE_TILT);
  const [rightAim, setRightAim] = useState(-INWARD_GLOVE_TILT);

  const rootRef = useRef<HTMLDivElement>(null);
  const bodiesRef = useRef<{ left: GloveBody; right: GloveBody }>({
    left: { x: GLOVE_ANCHORS.left.x, y: GLOVE_ANCHORS.left.y, vx: 0, vy: 0 },
    right: { x: GLOVE_ANCHORS.right.x, y: GLOVE_ANCHORS.right.y, vx: 0, vy: 0 },
  });
  const grabTargetRef = useRef<{ left: GlovePosition | null; right: GlovePosition | null }>({
    left: null,
    right: null,
  });
  const grabbingRef = useRef({ left: false, right: false });
  const historyRef = useRef<Map<number, HistPoint[]>>(new Map());
  const peakSpeedRef = useRef<Map<number, number>>(new Map());
  const lastPunchRef = useRef<Map<GloveId, number>>(new Map());
  const activeGloveRef = useRef<Map<number, GloveId>>(new Map());
  const lastDragRef = useRef<{ left: GlovePosition; right: GlovePosition }>({
    left: { ...GLOVE_ANCHORS.left },
    right: { ...GLOVE_ANCHORS.right },
  });
  const aimRef = useRef({ left: INWARD_GLOVE_TILT, right: -INWARD_GLOVE_TILT });

  const tryPunchOnStop = useCallback(
    (glove: GloveId, peakSpeed: number, now: number) => {
      const last = lastPunchRef.current.get(glove) ?? 0;
      if (peakSpeed >= fastSpeedPx && now - last > PUNCH_COOLDOWN_MS) {
        lastPunchRef.current.set(glove, now);
        onPunch(glove);
        return true;
      }
      return false;
    },
    [fastSpeedPx, onPunch]
  );

  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      const { stiffness, damping, wobbleAmp } = springFromTension(ELASTIC_TENSION);

      const leftBody = bodiesRef.current.left;
      const rightBody = bodiesRef.current.right;

      for (const side of ['left', 'right'] as const) {
        const body = side === 'left' ? leftBody : rightBody;
        const anchor = GLOVE_ANCHORS[side];
        const rest = idleWobble(anchor, side, now, wobbleAmp);

        if (grabbingRef.current[side] && grabTargetRef.current[side]) {
          const target = grabTargetRef.current[side]!;
          const prev = lastDragRef.current[side];
          if (dt > 0) {
            body.vx = (target.x - prev.x) / dt;
            body.vy = (target.y - prev.y) / dt;
          }
          body.x = target.x;
          body.y = target.y;
          lastDragRef.current[side] = { ...target };
        } else {
          const ax = stiffness * (rest.x - body.x) - damping * body.vx;
          const ay = stiffness * (rest.y - body.y) - damping * body.vy;
          body.vx += ax * dt;
          body.vy += ay * dt;
          body.x += body.vx * dt;
          body.y += body.vy * dt;
        }

        const normSpeed = Math.hypot(body.vx, body.vy);
        const targetAim =
          normSpeed > MOVE_AIM_NORM_SPEED
            ? aimFromVelocity(body.vx, body.vy, side)
            : inwardAim(side);
        aimRef.current[side] = lerpAngle(aimRef.current[side], targetAim, AIM_FOLLOW_SPEED);
      }

      resolveOverlap(leftBody, rightBody, GLOVE_MIN_SEPARATION);

      leftBody.x = Math.max(0, Math.min(LEFT_GLOVE_MAX_X, leftBody.x));
      rightBody.x = Math.max(RIGHT_GLOVE_MIN_X, Math.min(1, rightBody.x));
      leftBody.y = Math.max(GRID_TOP_Y, leftBody.y);
      rightBody.y = Math.max(GRID_TOP_Y, rightBody.y);

      const leftPos = { x: leftBody.x, y: leftBody.y };
      const rightPos = { x: rightBody.x, y: rightBody.y };

      setLeftAim(aimRef.current.left);
      setRightAim(aimRef.current.right);

      setLeft((prev) => ({
        ...prev,
        position: leftPos,
        trail: prev.trail.filter((p) => now - p.t < TRAIL_FADE_MS),
      }));
      setRight((prev) => ({
        ...prev,
        position: rightPos,
        trail: prev.trail.filter((p) => now - p.t < TRAIL_FADE_MS),
      }));

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const setTarget = useCallback(
    (glove: GloveId, raw: GlovePosition, pointerId: number, isMove: boolean, root: HTMLElement) => {
      const now = performance.now();
      const rect = root.getBoundingClientRect();
      let pos = clampGlovePosition(glove, raw);

      const other = glove === 'left' ? bodiesRef.current.right : bodiesRef.current.left;
      const dx = pos.x - other.x;
      const dy = pos.y - other.y;
      const dist = Math.hypot(dx, dy);
      if (dist < GLOVE_MIN_SEPARATION && dist > 1e-8) {
        const nx = dx / dist;
        const ny = dy / dist;
        pos = { x: other.x + nx * GLOVE_MIN_SEPARATION, y: other.y + ny * GLOVE_MIN_SEPARATION };
      }

      grabTargetRef.current[glove] = pos;

      if (isMove) {
        const px = pos.x * rect.width;
        const py = pos.y * rect.height;
        const hist = historyRef.current.get(pointerId) ?? [];
        hist.push({ x: pos.x, y: pos.y, t: now, px, py });
        const recent = hist.filter((h) => h.t > now - 100);
        historyRef.current.set(pointerId, recent);
        const speed = speedFromHistory(recent);
        const prevPeak = peakSpeedRef.current.get(pointerId) ?? 0;
        peakSpeedRef.current.set(pointerId, Math.max(prevPeak, speed));

        if (speed >= fastSpeedPx) {
          const point: TrailPoint = { x: pos.x, y: pos.y, t: now, isPunch: false };
          const setter = glove === 'left' ? setLeft : setRight;
          setter((prev) => ({
            ...prev,
            trail: [...prev.trail, point].filter((p) => now - p.t < TRAIL_FADE_MS).slice(-TRAIL_MAX),
          }));
        }
      }
    },
    [fastSpeedPx]
  );

  const beginGrab = useCallback(
    (glove: GloveId, e: React.PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;

      grabbingRef.current[glove] = true;
      activeGloveRef.current.set(e.pointerId, glove);
      peakSpeedRef.current.set(e.pointerId, 0);
      root.setPointerCapture(e.pointerId);

      const setter = glove === 'left' ? setLeft : setRight;
      setter((prev) => ({ ...prev, pointerId: e.pointerId }));

      const pos = normFromEvent(e, root);
      lastDragRef.current[glove] = pos;
      setTarget(glove, pos, e.pointerId, false, root);
    },
    [setTarget]
  );

  const onRootDown = useCallback(
    (e: React.PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if ((e.target as HTMLElement).closest('button, a, input, .play-ui')) return;

      const pos = normFromEvent(e, root);
      const glove = gloveFromScreenX(pos.x);
      beginGrab(glove, e);
    },
    [beginGrab]
  );

  const onRootMove = useCallback(
    (e: React.PointerEvent) => {
      const root = rootRef.current;
      const glove = activeGloveRef.current.get(e.pointerId);
      if (!root || !glove) return;
      setTarget(glove, normFromEvent(e, root), e.pointerId, true, root);
    },
    [setTarget]
  );

  const onRootUp = useCallback(
    (e: React.PointerEvent) => {
      const root = rootRef.current;
      const glove = activeGloveRef.current.get(e.pointerId);
      if (!glove || !root) return;

      const now = performance.now();
      const peakSpeed = peakSpeedRef.current.get(e.pointerId) ?? 0;
      const pos = normFromEvent(e, root);
      const isPunch = tryPunchOnStop(glove, peakSpeed, now);

      if (isPunch) {
        const setter = glove === 'left' ? setLeft : setRight;
        setter((prev) => ({
          ...prev,
          trail: [...prev.trail, { x: pos.x, y: pos.y, t: now, isPunch: true }]
            .filter((p) => now - p.t < TRAIL_FADE_MS)
            .slice(-TRAIL_MAX),
        }));
      }

      grabbingRef.current[glove] = false;
      grabTargetRef.current[glove] = null;

      const setter = glove === 'left' ? setLeft : setRight;
      setter((prev) => ({ ...prev, pointerId: null }));
      activeGloveRef.current.delete(e.pointerId);
      historyRef.current.delete(e.pointerId);
      peakSpeedRef.current.delete(e.pointerId);

      if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
    },
    [tryPunchOnStop]
  );

  const leftZoneSrc = leftGloveZoneSrc(left.position);
  const rightZoneSrc = rightGloveZoneSrc(right.position);
  const leftTransform = gloveVisual(left.position, GLOVE_ANCHORS.left, 'left', true, leftAim);
  const rightTransform = gloveVisual(right.position, GLOVE_ANCHORS.right, 'right', true, rightAim);

  return {
    left,
    right,
    leftTransform,
    rightTransform,
    leftZoneSrc,
    rightZoneSrc,
    rootRef,
    onRootDown,
    onRootMove,
    onRootUp,
  };
}
