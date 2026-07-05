import { useCallback, useRef, useState } from 'react';
import type { GloveId, GlovePosition, GloveState } from '../types/game';

const PUNCH_SPEED = 0.85; // px/ms — quick flick registers as punch
const TRAIL_SPEED = 0.35; // px/ms — slug shadow on faster moves
const PUNCH_COOLDOWN_MS = 180;
const TRAIL_MAX = 40;
const TRAIL_FADE_MS = 650;

const GUARD_LEFT: GlovePosition = { x: 0.34, y: 0.62 };
const GUARD_RIGHT: GlovePosition = { x: 0.66, y: 0.62 };

type HistPoint = { x: number; y: number; t: number; px: number; py: number };

function makeGlove(pos: GlovePosition): GloveState {
  return { position: { ...pos }, trail: [], pointerId: null };
}

function normFromEventOnRoot(e: PointerEvent | React.PointerEvent, root: HTMLElement): GlovePosition {
  const rect = root.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / rect.width,
    y: (e.clientY - rect.top) / rect.height,
  };
}

function speedFromHistory(recent: HistPoint[]): number {
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const dt = last.t - first.t;
  const d = Math.hypot(last.px - first.px, last.py - first.py);
  return dt > 0 ? d / dt : 0;
}

export function useGloveControl(onPunch: (glove: GloveId) => void) {
  const [left, setLeft] = useState<GloveState>(() => makeGlove(GUARD_LEFT));
  const [right, setRight] = useState<GloveState>(() => makeGlove(GUARD_RIGHT));
  const rootRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Map<number, HistPoint[]>>(new Map());
  const lastPunchRef = useRef<Map<GloveId, number>>(new Map());
  const activeGloveRef = useRef<Map<number, GloveId>>(new Map());

  const tryPunch = useCallback(
    (glove: GloveId, pointerId: number, speed: number, now: number) => {
      const lastPunch = lastPunchRef.current.get(glove) ?? 0;
      if (speed > PUNCH_SPEED && now - lastPunch > PUNCH_COOLDOWN_MS) {
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

  const updateGlove = useCallback(
    (glove: GloveId, pos: GlovePosition, pointerId: number, isMove: boolean, root: HTMLElement) => {
      const setter = glove === 'left' ? setLeft : setRight;
      const now = performance.now();
      const rect = root.getBoundingClientRect();
      const px = pos.x * rect.width;
      const py = pos.y * rect.height;

      let isPunch = false;
      let speed = 0;

      if (isMove) {
        const hist = historyRef.current.get(pointerId) ?? [];
        hist.push({ x: pos.x, y: pos.y, t: now, px, py });
        const cutoff = now - 100;
        const recent = hist.filter((h) => h.t > cutoff);
        historyRef.current.set(pointerId, recent);
        speed = speedFromHistory(recent);
        isPunch = tryPunch(glove, pointerId, speed, now);
      }

      setter((prev) => {
        const addTrail = isMove && (isPunch || speed > TRAIL_SPEED);
        const trail = addTrail
          ? [...prev.trail, { x: pos.x, y: pos.y, t: now, isPunch }]
              .filter((p) => now - p.t < TRAIL_FADE_MS)
              .slice(-TRAIL_MAX)
          : prev.trail.filter((p) => now - p.t < TRAIL_FADE_MS);
        return { ...prev, position: pos, trail, pointerId };
      });
    },
    [tryPunch]
  );

  const onGloveDown = useCallback(
    (glove: GloveId) => (e: React.PointerEvent) => {
      e.stopPropagation();
      const root = rootRef.current;
      if (!root) return;

      const pos = normFromEventOnRoot(e, root);
      activeGloveRef.current.set(e.pointerId, glove);
      root.setPointerCapture(e.pointerId);
      updateGlove(glove, pos, e.pointerId, false, root);
    },
    [updateGlove]
  );

  const onRootMove = useCallback(
    (e: React.PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;

      const glove = activeGloveRef.current.get(e.pointerId);
      if (!glove) return;

      const pos = normFromEventOnRoot(e, root);
      updateGlove(glove, pos, e.pointerId, true, root);
    },
    [updateGlove]
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
        const pos = normFromEventOnRoot(e, root);
        const setter = glove === 'left' ? setLeft : setRight;
        setter((prev) => ({
          ...prev,
          trail: [...prev.trail, { x: pos.x, y: pos.y, t: now, isPunch: true }]
            .filter((p) => now - p.t < TRAIL_FADE_MS)
            .slice(-TRAIL_MAX),
        }));
      }

      const setter = glove === 'left' ? setLeft : setRight;
      setter((prev) => ({ ...prev, pointerId: null }));
      activeGloveRef.current.delete(e.pointerId);
      historyRef.current.delete(e.pointerId);

      if (root.hasPointerCapture(e.pointerId)) {
        root.releasePointerCapture(e.pointerId);
      }
    },
    [tryPunch]
  );

  return {
    left,
    right,
    rootRef,
    onGloveDown,
    onRootMove,
    onRootUp,
  };
}
