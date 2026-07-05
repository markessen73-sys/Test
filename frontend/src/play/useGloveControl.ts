import { useCallback, useRef, useState } from 'react';
import type { GloveId, GlovePosition, GloveState } from '../types/game';

const PUNCH_SPEED = 1.4; // px/ms — quick flick registers as punch
const TRAIL_SPEED = 0.45; // px/ms — slug shadow on faster moves
const PUNCH_COOLDOWN_MS = 220;
const TRAIL_MAX = 40;
const TRAIL_FADE_MS = 600;

const GUARD_LEFT: GlovePosition = { x: 0.34, y: 0.62 };
const GUARD_RIGHT: GlovePosition = { x: 0.66, y: 0.62 };

function makeGlove(pos: GlovePosition): GloveState {
  return { position: { ...pos }, trail: [], pointerId: null };
}

function normFromEventOnRoot(e: React.PointerEvent, root: HTMLElement): GlovePosition {
  const rect = root.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) / rect.width,
    y: (e.clientY - rect.top) / rect.height,
  };
}

export function useGloveControl(onPunch: (glove: GloveId) => void) {
  const [left, setLeft] = useState<GloveState>(() => makeGlove(GUARD_LEFT));
  const [right, setRight] = useState<GloveState>(() => makeGlove(GUARD_RIGHT));
  const rootRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<Map<number, { x: number; y: number; t: number; px: number; py: number }[]>>(
    new Map()
  );
  const lastPunchRef = useRef<Map<GloveId, number>>(new Map());
  const activeGloveRef = useRef<Map<number, GloveId>>(new Map());

  const updateGlove = useCallback(
    (
      glove: GloveId,
      pos: GlovePosition,
      pointerId: number,
      isMove: boolean,
      root: HTMLElement
    ) => {
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
        const cutoff = now - 90;
        const recent = hist.filter((h) => h.t > cutoff);
        historyRef.current.set(pointerId, recent);

        if (recent.length >= 2) {
          const first = recent[0];
          const last = recent[recent.length - 1];
          const dt = last.t - first.t;
          const d = Math.hypot(last.px - first.px, last.py - first.py);
          speed = dt > 0 ? d / dt : 0;

          const lastPunch = lastPunchRef.current.get(glove) ?? 0;
          if (speed > PUNCH_SPEED && now - lastPunch > PUNCH_COOLDOWN_MS) {
            isPunch = true;
            lastPunchRef.current.set(glove, now);
            onPunch(glove);
            historyRef.current.set(pointerId, [last]);
          }
        }
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
    [onPunch]
  );

  const onGloveDown = useCallback(
    (glove: GloveId) => (e: React.PointerEvent) => {
      e.stopPropagation();
      const root = rootRef.current;
      if (!root) return;

      const pos = normFromEventOnRoot(e, root);
      activeGloveRef.current.set(e.pointerId, glove);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      updateGlove(glove, pos, e.pointerId, false, root);
    },
    [updateGlove]
  );

  const onGloveMove = useCallback(
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

  const onGloveUp = useCallback((e: React.PointerEvent) => {
    const glove = activeGloveRef.current.get(e.pointerId);
    if (!glove) return;

    const setter = glove === 'left' ? setLeft : setRight;
    setter((prev) => ({ ...prev, pointerId: null }));
    activeGloveRef.current.delete(e.pointerId);
    historyRef.current.delete(e.pointerId);
  }, []);

  return {
    left,
    right,
    rootRef,
    onGloveDown,
    onGloveMove,
    onGloveUp,
  };
}
