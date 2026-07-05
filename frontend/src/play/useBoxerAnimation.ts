import { useCallback, useEffect, useRef, useState } from 'react';
import type { GloveId, GloveState, TrailPoint } from '../types/game';
import type { BoxerSkeletonPose, GloveTarget } from './skeleton/types';
import { GUARD_LEFT, GUARD_RIGHT } from './skeleton/types';
import {
  computeIdleGloveOffset,
  constrainGloveTarget,
  getGloveTransform,
  solveBoxerPose,
} from './skeleton/solvePose';

const PUNCH_SPEED = 0.85;
const TRAIL_SPEED = 0.35;
const PUNCH_COOLDOWN_MS = 180;
const TRAIL_MAX = 40;
const TRAIL_FADE_MS = 650;
const SMOOTH_RATE = 14; // higher = snappier IK follow
const RETRACT_RATE = 10;

type HistPoint = { x: number; y: number; t: number; px: number; py: number };

function makeGlove(pos: GloveTarget): GloveState {
  return { position: { ...pos }, trail: [], pointerId: null };
}

function normFromEvent(e: PointerEvent | React.PointerEvent, root: HTMLElement): GloveTarget {
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

function expSmooth(current: GloveTarget, target: GloveTarget, dt: number, rate: number): GloveTarget {
  const t = 1 - Math.exp(-rate * dt);
  return { x: current.x + (target.x - current.x) * t, y: current.y + (target.y - current.y) * t };
}

export function useBoxerAnimation(onPunch: (glove: GloveId) => void) {
  const [skeletonPose, setSkeletonPose] = useState<BoxerSkeletonPose>(() =>
    solveBoxerPose(GUARD_LEFT, GUARD_RIGHT, performance.now())
  );
  const [left, setLeft] = useState<GloveState>(() => makeGlove(GUARD_LEFT));
  const [right, setRight] = useState<GloveState>(() => makeGlove(GUARD_RIGHT));

  const rootRef = useRef<HTMLDivElement>(null);
  const targetsRef = useRef({ left: { ...GUARD_LEFT }, right: { ...GUARD_RIGHT } });
  const displayRef = useRef({ left: { ...GUARD_LEFT }, right: { ...GUARD_RIGHT } });
  const grabbingRef = useRef({ left: false, right: false });
  const historyRef = useRef<Map<number, HistPoint[]>>(new Map());
  const lastPunchRef = useRef<Map<GloveId, number>>(new Map());
  const activeGloveRef = useRef<Map<number, GloveId>>(new Map());
  const leftRef = useRef(left);
  const rightRef = useRef(right);
  leftRef.current = left;
  rightRef.current = right;

  const tryPunch = useCallback(
    (glove: GloveId, pointerId: number, speed: number, now: number) => {
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

  // 60fps animation loop — IK drives ghost body from smoothed glove positions
  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;

      const idle = computeIdleGloveOffset(now);
      const rate = grabbingRef.current.left || grabbingRef.current.right ? SMOOTH_RATE : RETRACT_RATE;

      const targetLeft: GloveTarget = grabbingRef.current.left
        ? targetsRef.current.left
        : idle.left;
      const targetRight: GloveTarget = grabbingRef.current.right
        ? targetsRef.current.right
        : idle.right;

      displayRef.current.left = expSmooth(displayRef.current.left, targetLeft, dt, rate);
      displayRef.current.right = expSmooth(displayRef.current.right, targetRight, dt, rate);

      const pose = solveBoxerPose(displayRef.current.left, displayRef.current.right, now);
      setSkeletonPose(pose);

      setLeft((prev) => ({
        ...prev,
        position: { x: pose.leftArm.hand.x, y: pose.leftArm.hand.y },
        trail: prev.trail.filter((p) => now - p.t < TRAIL_FADE_MS),
      }));
      setRight((prev) => ({
        ...prev,
        position: { x: pose.rightArm.hand.x, y: pose.rightArm.hand.y },
        trail: prev.trail.filter((p) => now - p.t < TRAIL_FADE_MS),
      }));

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const setTarget = useCallback(
    (glove: GloveId, raw: GloveTarget, pointerId: number, isMove: boolean, root: HTMLElement) => {
      const now = performance.now();
      const rect = root.getBoundingClientRect();
      const other =
        glove === 'left' ? displayRef.current.right : displayRef.current.left;
      const constrained = constrainGloveTarget(glove, raw, other, now);

      if (glove === 'left') targetsRef.current.left = constrained;
      else targetsRef.current.right = constrained;

      let isPunch = false;
      let speed = 0;

      if (isMove) {
        const px = constrained.x * rect.width;
        const py = constrained.y * rect.height;
        const hist = historyRef.current.get(pointerId) ?? [];
        hist.push({ x: constrained.x, y: constrained.y, t: now, px, py });
        const recent = hist.filter((h) => h.t > now - 100);
        historyRef.current.set(pointerId, recent);
        speed = speedFromHistory(recent);
        isPunch = tryPunch(glove, pointerId, speed, now);

        const setter = glove === 'left' ? setLeft : setRight;
        const addTrail = isPunch || speed > TRAIL_SPEED;
        if (addTrail) {
          const point: TrailPoint = { x: constrained.x, y: constrained.y, t: now, isPunch };
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
      setTarget(glove, normFromEvent(e, root), e.pointerId, false, root);
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
      const isPunch = tryPunch(glove, e.pointerId, speed, now);

      if (isPunch) {
        const pos = normFromEvent(e, root);
        const setter = glove === 'left' ? setLeft : setRight;
        setter((prev) => ({
          ...prev,
          trail: [...prev.trail, { x: pos.x, y: pos.y, t: now, isPunch: true }]
            .filter((p) => now - p.t < TRAIL_FADE_MS)
            .slice(-TRAIL_MAX),
        }));
      }

      grabbingRef.current[glove] = false;
      targetsRef.current[glove] = glove === 'left' ? { ...GUARD_LEFT } : { ...GUARD_RIGHT };

      const setter = glove === 'left' ? setLeft : setRight;
      setter((prev) => ({ ...prev, pointerId: null }));
      activeGloveRef.current.delete(e.pointerId);
      historyRef.current.delete(e.pointerId);

      if (root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId);
    },
    [tryPunch]
  );

  const leftTransform = getGloveTransform(skeletonPose.leftArm, 'left');
  const rightTransform = getGloveTransform(skeletonPose.rightArm, 'right');

  return {
    skeletonPose,
    left,
    right,
    leftTransform,
    rightTransform,
    rootRef,
    onGloveDown,
    onRootMove,
    onRootUp,
  };
}

export { GUARD_LEFT as GHOST_GUARD_LEFT, GUARD_RIGHT as GHOST_GUARD_RIGHT };
