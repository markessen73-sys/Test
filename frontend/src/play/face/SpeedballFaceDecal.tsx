import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { drawFullFaceOnCanvas, loadFaceImage } from './composeFaceTexture'
import { useCharacter } from './CharacterContext'
import { SPEEDBALL_FACE_RADIUS } from './speedballFacePlacement'
import { paintOohReaction, skinFromFaceImage, type PopEyePair } from './paintOohReaction'
import { paintKnockoutFace } from './paintKnockout'
import type { Rgb } from '../../face-capture/popEyes'

const CANVAS_SIZE = 512
/** Match ring partner hit-face window (eyes zoom during this). */
const OOH_MS = 720

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
 * Photo faces with eye marks animate pop-eyes zooming ½→full.
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
  const popEyesRef = useRef<PopEyePair | null>(null)
  const skinRef = useRef<Rgb | null>(null)
  const knockedOutRef = useRef(knockedOut)
  knockedOutRef.current = knockedOut
  const lastPaintedAgeRef = useRef(-1)
  const hitTimeRef = useRef(lastHitTime)
  if (hitTimeRef.current !== lastHitTime) {
    hitTimeRef.current = lastHitTime
    lastPaintedAgeRef.current = -1
  }

  const geometry = useMemo(() => createFrontWrapGeometry(SPEEDBALL_FACE_RADIUS), [])

  useEffect(() => () => geometry.dispose(), [geometry])

  const paint = (img: HTMLImageElement, hitAgeMs?: number) => {
    const canvas = canvasRef.current
    const tex = texRef.current
    if (!canvas || !tex) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (hitAgeMs != null && popEyesRef.current) {
      paintOohReaction(ctx, CANVAS_SIZE, img, {
        popEyes: popEyesRef.current,
        skin: skinRef.current,
        hitAgeMs,
        oohMs: OOH_MS,
      })
    } else {
      drawFullFaceOnCanvas(ctx, img, CANVAS_SIZE, CANVAS_SIZE)
    }
    tex.needsUpdate = true
  }

  const paintKo = (ko: HTMLImageElement, timeMs: number) => {
    const canvas = canvasRef.current
    const tex = texRef.current
    if (!canvas || !tex) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    paintKnockoutFace(ctx, CANVAS_SIZE, ko, timeMs)
    tex.needsUpdate = true
  }

  popEyesRef.current = character.popEyes ?? null

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

    skinRef.current = null
    const marks = character.popEyes ?? null
    popEyesRef.current = marks

    Promise.all([
      loadFaceImage(character.cleanSrc),
      loadFaceImage(character.oohSrc),
      loadFaceImage(character.knockoutSrc),
    ]).then(([normal, ooh, ko]) => {
      if (cancelled) return
      normalRef.current = normal
      oohRef.current = ooh
      koRef.current = ko
      if (marks) {
        skinRef.current = skinFromFaceImage(ooh, marks)
      }
      paint(knockedOutRef.current ? ko : normal)
    })

    return () => {
      cancelled = true
      tex.dispose()
    }
  }, [character.id, character.cleanSrc, character.oohSrc, character.knockoutSrc, character.popEyes])

  useEffect(() => {
    lastPaintedAgeRef.current = -1
    const ko = koRef.current
    const normal = normalRef.current
    if (knockedOut) {
      if (ko) {
        if (character.isPhotoFace) paintKo(ko, performance.now())
        else paint(ko)
      }
      return
    }
    if (normal) paint(normal)
  }, [knockedOut, character.isPhotoFace])

  useFrame(() => {
    if (knockedOutRef.current) {
      if (!character.isPhotoFace) return
      const ko = koRef.current
      if (!ko) return
      const bucket = Math.floor(performance.now() / 32)
      if (bucket === lastPaintedAgeRef.current) return
      lastPaintedAgeRef.current = bucket
      paintKo(ko, performance.now())
      return
    }
    const hitT = hitTimeRef.current
    if (!hitT) return
    const normal = normalRef.current
    const ooh = oohRef.current
    if (!normal || !ooh) return

    const age = performance.now() - hitT
    if (age >= 0 && age < OOH_MS) {
      const bucket = Math.floor(age / 16)
      if (bucket === lastPaintedAgeRef.current) return
      lastPaintedAgeRef.current = bucket
      paint(ooh, popEyesRef.current ? age : undefined)
    } else if (lastPaintedAgeRef.current !== -2) {
      lastPaintedAgeRef.current = -2
      paint(normal)
    }
  })

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
