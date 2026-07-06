import { useCallback, useEffect, useRef, useState } from 'react';
import type { GloveId, GloveState, TrailPoint, GlovePosition } from '../types/game';
import type { GloveTransform } from './skeleton/types';
import {
  ELASTIC_TENSION,
  GLOVE_ANCHORS,
  GLOVE_MIN_SEPARATION,
  GUARD_GLOVE_POSE,
  springFromTension,
} from './elasticConfig';
import {
  clampGlovePosition,
  LEFT_GLOVE_MAX_X,
  rightGloveZoneSrc,
  RIGHT_GLOVE_MIN_X,
} from './gloveZoneGrid';

const PUNCH_SPEED = 0.85;
const PUNCH_COOLDOWN_MS = 180;
const TRAIL_SPEED = 0.35;
const TRAIL_MAX = 40;
const TRAIL_FADE_MS = 650;

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

function gloveVisual(pos: GlovePosition, anchor: GlovePosition, side: GloveId): GloveTransform {
  const stretch = Math.hypot(pos.x - anchor.x, pos.y - anchor.y);
  if (side === 'right') {
    return { rotate: 0, scale: 1 + stretch * 0.06, scaleX: 1, skewX: 0, originY: '68%' };
  }
  const guard = GUARD_GLOVE_POSE[side];
  return {
    ...guard,
    scale: guard.scale + stretch * 0.12,
  };
}

export function useElasticGloves(onPunch: (glove: GloveId) => void) {
  const [left, setLeft] = useState<GloveState>(() => makeGlove(GLOVE_ANCHORS.left));
  const [right, setRight] = useState<GloveState>(() => makeGlove(GLOVE_ANCHORS.right));

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
  const lastPunchRef = useRef<Map<GloveId, number>>(new Map());
  const activeGloveRef = useRef<Map<number, GloveId>>(new Map());
  const lastDragRef = useRef<{ left: GlovePosition; right: GlovePosition }>({
    left: { ...GLOVE_ANCHORS.left },
    right: { ...GLOVE_ANCHORS.right },
  });

  const tryPunch = useCallback(
    (glove: GloveId, pointerId: number, speed: number, now: number, _pos: GlovePosition) => {
      const last = lastPunchRef.current.get(glove) ?? 0;
      if (speed > PUNCH_SPEED && now - last > PUNCH_COOLDOWN_MS) {
        lastPunchRef.current.set(glove, now);
        onPunch(glove);
        const hist = historyRef.current.get(pointerId);
        if (hist?.length) historyRef.current.set(pointerId, [hist[hist.length - 1]]);
        return true;
      }
      return false;
    },
    [onPunch]
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
      }

      resolveOverlap(leftBody, rightBody, GLOVE_MIN_SEPARATION);

      rightBody.x = Math.max(RIGHT_GLOVE_MIN_X, rightBody.x);
      leftBody.x = Math.min(LEFT_GLOVE_MAX_X, leftBody.x);

      const leftPos = { x: leftBody.x, y: leftBody.y };
      const rightPos = { x: rightBody.x, y: rightBody.y };

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
        const isPunch = tryPunch(glove, pointerId, speed, now, pos);

        if (isPunch || speed > TRAIL_SPEED) {
          const point: TrailPoint = { x: pos.x, y: pos.y, t: now, isPunch };
          const setter = glove === 'left' ? setLeft : setRight;
          setter((prev) => ({
            ...prev,
            trail: [...prev.trail, point].filter((p) => now - p.t < TRAIL_FADE_MS).slice(-TRAIL_MAX),
          }));
        }
      }
    },
    [tryPunch]
  );

  const onGloveDown = useCallback(
    (glove: GloveId) => (e: React.PointerEvent) => {
      e.stopPropagation();
      const root = rootRef.current;
      if (!root) return;
      grabbingRef.current[glove] = true;
      activeGloveRef.current.set(e.pointerId, glove);
      root.setPointerCapture(e.pointerId);
      const setter = glove === 'left' ? setLeft : setRight;
      setter((prev) => ({ ...prev, pointerId: e.pointerId }));
      const pos = normFromEvent(e, root);
      lastDragRef.current[glove] = pos;
      setTarget(glove, pos, e.pointerId, false, root);
    },
    [setTarget]
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
      const hist = historyRef.current.get(e.pointerId) ?? [];
      const speed = speedFromHistory(hist);
      const pos = normFromEvent(e, root);
      const isPunch = tryPunch(glove, e.pointerId, speed, now, pos);

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

      if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
    },
    [tryPunch]
  );

  const leftTransform = gloveVisual(left.position, GLOVE_ANCHORS.left, 'left');
  const rightTransform = gloveVisual(right.position, GLOVE_ANCHORS.right, 'right');
  const rightZoneSrc = rightGloveZoneSrc(right.position);

  return {
    left,
    right,
    leftTransform,
    rightTransform,
    rightZoneSrc,
    rootRef,
    onGloveDown,
    onRootMove,
    onRootUp,
  };
}
