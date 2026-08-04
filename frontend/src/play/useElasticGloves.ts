import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { GloveId, GloveState, TrailPoint, GlovePosition } from '../types/game';
import type { GloveTransform } from './skeleton/types';
import {
  ELASTIC_TENSION,
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
  GLOVE_BAG_REACH_SEPARATION,
  LEFT_GLOVE_MAX_X,
  leftGloveZoneSrc,
  rightGloveZoneSrc,
  RIGHT_GLOVE_MIN_X,
} from './gloveZoneGrid';
import {
  gloveBottomNorm,
  gloveKnuckleNorm,
  ZONE_GLOVE_W,
} from './gloveGeometry';
import { useGlove } from './GloveContext';

const TRAIL_MAX = 56;
const TRAIL_FADE_MS = 520;
const TRAIL_EMIT_MS = 24;
const PUNCH_COOLDOWN_MS = 180;
const RELEASE_MIN_NORM_SPEED = 0.1;
const UPWARD_VY_NORM = 0.06;
const AIM_FOLLOW_SPEED = 0.2;
const MOVE_AIM_NORM_SPEED = 0.35;

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

function appendTrail(
  trail: TrailPoint[],
  point: TrailPoint,
  now: number,
  minGapMs: number
): TrailPoint[] {
  const last = trail[trail.length - 1];
  if (!point.isPunch && last && now - last.t < minGapMs) {
    return trail.filter((p) => now - p.t < TRAIL_FADE_MS);
  }
  return [...trail.filter((p) => now - p.t < TRAIL_FADE_MS), point].slice(-TRAIL_MAX);
}

function makeBottomTrailPoint(
  cuffPos: GlovePosition,
  aimDeg: number,
  scale: number,
  screenW: number,
  screenH: number,
  side: GloveId,
  now: number,
  isPunch: boolean
): TrailPoint {
  const bottom = gloveBottomNorm(cuffPos, aimDeg, scale, screenW, screenH, side);
  return {
    x: bottom.x,
    y: bottom.y,
    t: now,
    isPunch,
    width: ZONE_GLOVE_W / screenW,
    angle: aimDeg,
  };
}

function isMovingUpward(vy: number): boolean {
  return vy < -UPWARD_VY_NORM;
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
  return side === 'left' ? -INWARD_GLOVE_TILT : INWARD_GLOVE_TILT;
}

function aimFromVelocity(vx: number, vy: number): number {
  const moveDeg = (Math.atan2(vy, vx) * 180) / Math.PI;
  if (vy > 0) return moveDeg - 90;
  return moveDeg + 90;
}

function lerpAngle(current: number, target: number, t: number): number {
  let delta = ((target - current + 180) % 360) - 180;
  if (delta < -180) delta += 360;
  return current + delta * t;
}

function isDraggingTowardBag(glove: GloveId, pos: GlovePosition, other: GlovePosition): boolean {
  if (glove === 'right') return pos.x < other.x + 0.02;
  return pos.x > other.x - 0.02;
}

function minSeparationForDrag(glove: GloveId, pos: GlovePosition, other: GlovePosition): number {
  return isDraggingTowardBag(glove, pos, other) ? GLOVE_BAG_REACH_SEPARATION : GLOVE_MIN_SEPARATION;
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

export interface UseElasticGlovesOptions {
  onPunch: (glove: GloveId, knuckle: GlovePosition) => void;
  targetZoneOffsetRef: RefObject<GlovePosition>;
  isKnuckleOnTarget: (
    knuckle: GlovePosition,
    zoneOffset: GlovePosition,
    contact: { glove: GloveId; cuff: GlovePosition }
  ) => boolean;
}

export function useElasticGloves({
  onPunch,
  targetZoneOffsetRef,
  isKnuckleOnTarget,
}: UseElasticGlovesOptions) {
  const { glove: loadout } = useGlove();
  const [left, setLeft] = useState<GloveState>(() => makeGlove(GLOVE_ANCHORS.left));
  const [right, setRight] = useState<GloveState>(() => makeGlove(GLOVE_ANCHORS.right));
  const [leftAim, setLeftAim] = useState(-INWARD_GLOVE_TILT);
  const [rightAim, setRightAim] = useState(INWARD_GLOVE_TILT);

  const rootRef = useRef<HTMLDivElement>(null);
  const rootSizeRef = useRef({ width: 1, height: 1 });
  const bodiesRef = useRef<{ left: GloveBody; right: GloveBody }>({
    left: { x: GLOVE_ANCHORS.left.x, y: GLOVE_ANCHORS.left.y, vx: 0, vy: 0 },
    right: { x: GLOVE_ANCHORS.right.x, y: GLOVE_ANCHORS.right.y, vx: 0, vy: 0 },
  });
  const grabTargetRef = useRef<{ left: GlovePosition | null; right: GlovePosition | null }>({
    left: null,
    right: null,
  });
  const grabbingRef = useRef({ left: false, right: false });
  const lastPunchRef = useRef<Map<GloveId, number>>(new Map());
  const activeGloveRef = useRef<Map<number, GloveId>>(new Map());
  const lastDragRef = useRef<{ left: GlovePosition; right: GlovePosition }>({
    left: { ...GLOVE_ANCHORS.left },
    right: { ...GLOVE_ANCHORS.right },
  });
  const aimRef = useRef({ left: -INWARD_GLOVE_TILT, right: INWARD_GLOVE_TILT });

  const syncRootSize = useCallback((root: HTMLElement) => {
    const rect = root.getBoundingClientRect();
    rootSizeRef.current = { width: rect.width, height: rect.height };
  }, []);

  const tryPunchOnRelease = useCallback(
    (glove: GloveId, releaseSpeed: number, knucklePos: GlovePosition, now: number) => {
      const last = lastPunchRef.current.get(glove) ?? 0;
      if (
        releaseSpeed >= RELEASE_MIN_NORM_SPEED &&
        isKnuckleOnTarget(knucklePos, targetZoneOffsetRef.current, {
          glove,
          cuff: { x: bodiesRef.current[glove].x, y: bodiesRef.current[glove].y },
        }) &&
        now - last > PUNCH_COOLDOWN_MS
      ) {
        lastPunchRef.current.set(glove, now);
        onPunch(glove, knucklePos);
        return true;
      }
      return false;
    },
    [isKnuckleOnTarget, onPunch, targetZoneOffsetRef]
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sync = () => syncRootSize(root);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(root);
    window.addEventListener('resize', sync);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [syncRootSize]);

  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      const { stiffness, damping, wobbleAmp } = springFromTension(ELASTIC_TENSION);
      const { width: screenW, height: screenH } = rootSizeRef.current;

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
          normSpeed > MOVE_AIM_NORM_SPEED ? aimFromVelocity(body.vx, body.vy) : inwardAim(side);
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

      setLeft((prev) => {
        const trail = prev.trail.filter((p) => now - p.t < TRAIL_FADE_MS);
        if (grabbingRef.current.left && isMovingUpward(leftBody.vy)) {
          const scale = gloveVisual(leftPos, GLOVE_ANCHORS.left, 'left', true, aimRef.current.left).scale;
          const pt = makeBottomTrailPoint(
            leftPos,
            aimRef.current.left,
            scale,
            screenW,
            screenH,
            'left',
            now,
            false
          );
          return { ...prev, position: leftPos, trail: appendTrail(trail, pt, now, TRAIL_EMIT_MS) };
        }
        return { ...prev, position: leftPos, trail };
      });
      setRight((prev) => {
        const trail = prev.trail.filter((p) => now - p.t < TRAIL_FADE_MS);
        if (grabbingRef.current.right && isMovingUpward(rightBody.vy)) {
          const scale = gloveVisual(rightPos, GLOVE_ANCHORS.right, 'right', true, aimRef.current.right).scale;
          const pt = makeBottomTrailPoint(
            rightPos,
            aimRef.current.right,
            scale,
            screenW,
            screenH,
            'right',
            now,
            false
          );
          return { ...prev, position: rightPos, trail: appendTrail(trail, pt, now, TRAIL_EMIT_MS) };
        }
        return { ...prev, position: rightPos, trail };
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const setTarget = useCallback((glove: GloveId, raw: GlovePosition, root: HTMLElement) => {
    syncRootSize(root);
    let pos = clampGlovePosition(glove, raw);

    const other = glove === 'left' ? bodiesRef.current.right : bodiesRef.current.left;
    const dx = pos.x - other.x;
    const dy = pos.y - other.y;
    const dist = Math.hypot(dx, dy);
    const minDist = minSeparationForDrag(glove, pos, other);
    if (dist < minDist && dist > 1e-8) {
      const nx = dx / dist;
      const ny = dy / dist;
      pos = { x: other.x + nx * minDist, y: other.y + ny * minDist };
    }

    grabTargetRef.current[glove] = pos;
  }, [syncRootSize]);

  const beginGrab = useCallback(
    (glove: GloveId, e: React.PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;

      syncRootSize(root);
      grabbingRef.current[glove] = true;
      activeGloveRef.current.set(e.pointerId, glove);
      root.setPointerCapture(e.pointerId);

      const setter = glove === 'left' ? setLeft : setRight;
      setter((prev) => ({ ...prev, pointerId: e.pointerId }));

      const pos = normFromEvent(e, root);
      lastDragRef.current[glove] = pos;
      setTarget(glove, pos, root);
    },
    [setTarget, syncRootSize]
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
      setTarget(glove, normFromEvent(e, root), root);
    },
    [setTarget]
  );

  const onRootUp = useCallback(
    (e: React.PointerEvent) => {
      const root = rootRef.current;
      const glove = activeGloveRef.current.get(e.pointerId);
      if (!glove || !root) return;

      syncRootSize(root);
      const now = performance.now();
      const body = glove === 'left' ? bodiesRef.current.left : bodiesRef.current.right;
      const cuffPos = { x: body.x, y: body.y };
      const aim = aimRef.current[glove];
      const { width: screenW, height: screenH } = rootSizeRef.current;
      const scale = gloveVisual(cuffPos, GLOVE_ANCHORS[glove], glove, true, aim).scale;
      const knucklePos = gloveKnuckleNorm(cuffPos, aim, scale, screenW, screenH, glove);
      const releaseSpeed = Math.hypot(body.vx, body.vy);

      grabbingRef.current[glove] = false;
      grabTargetRef.current[glove] = null;

      tryPunchOnRelease(glove, releaseSpeed, knucklePos, now);

      const setter = glove === 'left' ? setLeft : setRight;
      setter((prev) => ({
        ...prev,
        pointerId: null,
        trail: [],
      }));

      activeGloveRef.current.delete(e.pointerId);

      if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
    },
    [syncRootSize, tryPunchOnRelease]
  );

  const leftZoneSrc = leftGloveZoneSrc(left.position, loadout.zoneFolder);
  const rightZoneSrc = rightGloveZoneSrc(right.position, loadout.zoneFolder);
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
