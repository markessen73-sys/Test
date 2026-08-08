import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { drawFullFaceOnCanvas, loadFaceImage } from './composeFaceTexture'
import { useCharacter } from './CharacterContext'
import { SPEEDBALL_FACE_RADIUS } from './speedballFacePlacement'

const CANVAS_SIZE = 512
/** Match ring partner hit-face window. */
const OOH_MS = 380

/**
 * Front-hemisphere shell. Default SphereGeometry UVs already stretch the
 * texture across phi, so the caricature wraps around the curve instead of
 * sitting as a flat sticker.
 */
function createFrontWrapGeometry(radius: number): THREE.SphereGeometry {
  // phi 0..π → −X → +Z → +X (camera-facing half).
  // Slight theta crop keeps forehead/chin from stretching over the poles.
  return new THREE.SphereGeometry(
    radius,
    64,
    48,
    0,
    Math.PI,
    0.14 * Math.PI,
    0.72 * Math.PI
  )
}

interface SpeedballFaceDecalProps {
  /** Latest landed punch — swaps to the authored ooh face. */
  lastHitTime?: number
  /** Damage meter at 100% — hold the knockout face. */
  knockedOut?: boolean
  /** Optional material opacity (browse dimming). */
  opacity?: number
}

/**
 * Sparring-partner caricature wrapped on the front of the speedball.
 * Injuries live in the damage HUD (same as the ring). On hit → ooh; at 100% → KO.
 */
export function SpeedballFaceDecal({
  lastHitTime = 0,
  knockedOut = false,
  opacity = 1,
}: SpeedballFaceDecalProps) {
  const { character } = useCharacter()
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  const normalRef = useRef<HTMLImageElement | null>(null)
  const oohRef = useRef<HTMLImageElement | null>(null)
  const koRef = useRef<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const texRef = useRef<THREE.CanvasTexture | null>(null)
  const knockedOutRef = useRef(knockedOut)
  knockedOutRef.current = knockedOut

  const geometry = useMemo(() => createFrontWrapGeometry(SPEEDBALL_FACE_RADIUS), [])

  useEffect(() => () => geometry.dispose(), [geometry])

  const paint = (img: HTMLImageElement) => {
    const canvas = canvasRef.current
    const tex = texRef.current
    if (!canvas || !tex) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawFullFaceOnCanvas(ctx, img, CANVAS_SIZE, CANVAS_SIZE)
    tex.needsUpdate = true
  }

  useEffect(() => {
    let cancelled = false
    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_SIZE
    canvas.height = CANVAS_SIZE
    canvasRef.current = canvas
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    texRef.current = tex
    setTexture(tex)

    Promise.all([
      loadFaceImage(character.cleanSrc),
      loadFaceImage(character.oohSrc),
      loadFaceImage(character.knockoutSrc),
    ]).then(([normal, ooh, ko]) => {
      if (cancelled) return
      normalRef.current = normal
      oohRef.current = ooh
      koRef.current = ko
      paint(knockedOutRef.current ? ko : normal)
    })

    return () => {
      cancelled = true
      tex.dispose()
    }
  }, [character])

  useEffect(() => {
    const ko = koRef.current
    const normal = normalRef.current
    if (knockedOut) {
      if (ko) paint(ko)
      return
    }
    if (normal) paint(normal)
  }, [knockedOut])

  useEffect(() => {
    if (!lastHitTime || knockedOutRef.current) return
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      if (knockedOutRef.current) {
        const ko = koRef.current
        if (ko) paint(ko)
        cancelAnimationFrame(frame)
        return
      }
      const normal = normalRef.current
      const ooh = oohRef.current
      if (!normal || !ooh) return

      const age = performance.now() - lastHitTime
      const showOoh = age >= 0 && age < OOH_MS
      paint(showOoh ? ooh : normal)

      if (!showOoh && age >= OOH_MS) {
        cancelAnimationFrame(frame)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [lastHitTime])

  if (!texture) return null

  return (
    <mesh geometry={geometry} renderOrder={2}>
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}
