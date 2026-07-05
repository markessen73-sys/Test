import { useCallback, useRef, useState } from 'react';
import type { GloveId, GlovePosition, GloveState } from '../types/game';

const PUNCH_SPEED = 1.8; // px/ms — quick flick registers as punch
const TRAIL_SPEED = 0.55; // px/ms — slug shadow only on faster moves
const GRAB_RADIUS = 0.14; // normalized screen distance to grab a glove
const PUNCH_COOLDOWN_MS = 220;
const TRAIL_MAX = 40;
const TRAIL_FADE_MS = 600;

const GUARD_LEFT: GlovePosition = { x: 0.38, y: 0.58 };
const GUARD_RIGHT: GlovePosition = { x: 0.62, y: 0.58 };

function dist(a: GlovePosition, b: GlovePosition) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function makeGlove(pos: GlovePosition): GloveState {
  return { position: { ...pos }, trail: [], pointerId: null };
}

export function useGloveControl(onPunch: (glove: GloveId) => void) {
  const [left, setLeft] = useState<GloveState>(() => makeGlove(GUARD_LEFT));
  const [right, setRight] = useState<GloveState>(() => makeGlove(GUARD_RIGHT));
  const historyRef = useRef<Map<number, { x: number; y: number; t: number }[]>>(new Map());
  const lastPunchRef = useRef<Map<GloveId, number>>(new Map());

  const updateGlove = useCallback(
    (glove: GloveId, x: number, y: number, pointerId: number, isMove: boolean) => {
      const setter = glove === 'left' ? setLeft : setRight;
      const now = performance.now();

      let isPunch = false;
      let speed = 0;
      if (isMove) {
        const hist = historyRef.current.get(pointerId) ?? [];
        hist.push({ x, y, t: now });
        const cutoff = now - 80;
        const recent = hist.filter((h) => h.t > cutoff);
        historyRef.current.set(pointerId, recent);

        if (recent.length >= 2) {
          const first = recent[0];
          const last = recent[recent.length - 1];
          const dt = last.t - first.t;
          const d = Math.hypot(last.x - first.x, last.y - first.y);
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
          ? [...prev.trail, { x, y, t: now, isPunch }]
              .filter((p) => now - p.t < TRAIL_FADE_MS)
              .slice(-TRAIL_MAX)
          : prev.trail.filter((p) => now - p.t < TRAIL_FADE_MS);
        return { ...prev, position: { x, y }, trail, pointerId };
      });
    },
    [onPunch]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      const dLeft = dist({ x, y }, left.position);
      const dRight = dist({ x, y }, right.position);

      let glove: GloveId | null = null;
      if (left.pointerId === null && dLeft < GRAB_RADIUS) glove = 'left';
      else if (right.pointerId === null && dRight < GRAB_RADIUS) glove = 'right';
      else if (left.pointerId === null && right.pointerId !== null && dLeft < GRAB_RADIUS * 1.5)
        glove = 'left';
      else if (right.pointerId === null && left.pointerId !== null && dRight < GRAB_RADIUS * 1.5)
        glove = 'right';

      if (!glove) return;

      e.currentTarget.setPointerCapture(e.pointerId);
      updateGlove(glove, x, y, e.pointerId, false);
    },
    [left, right, updateGlove]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      if (left.pointerId === e.pointerId) updateGlove('left', x, y, e.pointerId, true);
      else if (right.pointerId === e.pointerId) updateGlove('right', x, y, e.pointerId, true);
    },
    [left.pointerId, right.pointerId, updateGlove]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const release = (glove: GloveId) => {
      const setter = glove === 'left' ? setLeft : setRight;
      setter((prev) => ({ ...prev, pointerId: null }));
      historyRef.current.delete(e.pointerId);
    };

    if (left.pointerId === e.pointerId) release('left');
    if (right.pointerId === e.pointerId) release('right');
  }, [left.pointerId, right.pointerId]);

  return { left, right, handlePointerDown, handlePointerMove, handlePointerUp };
}
