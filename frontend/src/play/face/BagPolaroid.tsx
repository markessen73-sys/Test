import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { assetUrl } from '../../assetUrl'
import { loadFaceImage } from './composeFaceTexture'
import { drawPolaroidOnCanvas, POLAROID_CANVAS_SIZE } from './composePolaroidTexture'
import {
  BAG_POLAROID_CENTER,
  BAG_POLAROID_HEIGHT,
  BAG_POLAROID_PIN_INSET,
  BAG_POLAROID_PIN_RADIUS,
  BAG_POLAROID_WIDTH,
  bagPolaroidHangsByOnePin,
  bagPolaroidPhaseForStage,
  type BagPolaroidPhase,
} from './bagPolaroid'

const SOURCE_PHOTO_SRC = assetUrl('/faces/source-photo-909c.png')

/** Floor Y in bag-local space (bag centre ≈ world 1.32 → floor ≈ -1.32). */
const FLOOR_LOCAL_Y = -1.22

function PinHead({
  position,
  opacity = 1,
}: {
  position: [number, number, number]
  opacity?: number
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.045, 8]} />
        <meshStandardMaterial
          color="#888890"
          metalness={0.85}
          roughness={0.35}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <sphereGeometry args={[BAG_POLAROID_PIN_RADIUS, 16, 12]} />
        <meshStandardMaterial
          color="#c0c4cc"
          metalness={0.9}
          roughness={0.25}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
    </group>
  )
}

interface BagPolaroidProps {
  /** Damage meter stage 0–10. */
  stage: number
  /** Latest punch time — jolts a one-pin hang. */
  lastHitTime?: number
  /** Browse dimming. */
  opacity?: number
}

/**
 * B&W Polaroid of the source photo, pinned to the heavy bag.
 * Tears / loses a pin / falls as the damage meter climbs.
 */
export function BagPolaroid({ stage, lastHitTime = 0, opacity = 1 }: BagPolaroidProps) {
  const phase = bagPolaroidPhaseForStage(stage)
  const hangOne = bagPolaroidHangsByOnePin(phase)
  /** Stay in left-pin pivot space through the final fall so the scrap doesn't jump. */
  const [pivotFromLeft, setPivotFromLeft] = useState(false)

  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const texRef = useRef<THREE.CanvasTexture | null>(null)
  const phaseRef = useRef<BagPolaroidPhase>(phase)
  phaseRef.current = phase

  const photoGroupRef = useRef<THREE.Group>(null)
  const hangAngleRef = useRef(0)
  const hangVelRef = useRef(0)
  const lastHitRef = useRef(0)

  const rightPinFallRef = useRef<THREE.Group>(null)
  const rightPinStartedRef = useRef(false)
  const rightPinVel = useRef({ x: 0.15, y: 0.4, z: 0.2, rot: 2.5 })
  const rightPinPos = useRef({ x: 0, y: 0, z: 0, rot: 0 })

  const fallRef = useRef({
    active: false,
    x: 0,
    y: 0,
    z: 0,
    rotZ: 0,
    rotX: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    wr: 0,
  })

  const leftPinLocal: [number, number, number] = useMemo(
    () => [
      -BAG_POLAROID_WIDTH / 2 + BAG_POLAROID_PIN_INSET,
      BAG_POLAROID_HEIGHT / 2 - BAG_POLAROID_PIN_INSET,
      0.02,
    ],
    []
  )
  const rightPinLocal: [number, number, number] = useMemo(
    () => [
      BAG_POLAROID_WIDTH / 2 - BAG_POLAROID_PIN_INSET,
      BAG_POLAROID_HEIGHT / 2 - BAG_POLAROID_PIN_INSET,
      0.02,
    ],
    []
  )

  const paint = (p: BagPolaroidPhase) => {
    const canvas = canvasRef.current
    const tex = texRef.current
    const img = imgRef.current
    if (!canvas || !tex || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawPolaroidOnCanvas(ctx, img, p)
    tex.needsUpdate = true
  }

  useEffect(() => {
    let cancelled = false
    const canvas = document.createElement('canvas')
    canvas.width = POLAROID_CANVAS_SIZE.width
    canvas.height = POLAROID_CANVAS_SIZE.height
    canvasRef.current = canvas
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    texRef.current = tex
    setTexture(tex)

    loadFaceImage(SOURCE_PHOTO_SRC).then((img) => {
      if (cancelled) return
      imgRef.current = img
      paint(phaseRef.current)
    })

    return () => {
      cancelled = true
      tex.dispose()
    }
  }, [])

  useEffect(() => {
    paint(phase)

    if (hangOne) setPivotFromLeft(true)

    if (
      (phase === 'onePin' ||
        phase === 'bothCorners' ||
        phase === 'halfTear' ||
        phase === 'fallen') &&
      !rightPinStartedRef.current
    ) {
      rightPinStartedRef.current = true
      rightPinPos.current = {
        x: BAG_POLAROID_CENTER[0] + rightPinLocal[0],
        y: BAG_POLAROID_CENTER[1] + rightPinLocal[1],
        z: BAG_POLAROID_CENTER[2] + rightPinLocal[2],
        rot: 0,
      }
      rightPinVel.current = {
        x: 0.25 + Math.random() * 0.15,
        y: 0.55,
        z: 0.35,
        rot: 3 + Math.random() * 2,
      }
    }

    if (phase === 'fallen' && !fallRef.current.active) {
      const g = photoGroupRef.current
      fallRef.current = {
        active: true,
        x: g?.position.x ?? BAG_POLAROID_CENTER[0] + leftPinLocal[0],
        y: g?.position.y ?? BAG_POLAROID_CENTER[1] + leftPinLocal[1],
        z: g?.position.z ?? BAG_POLAROID_CENTER[2],
        rotZ: g?.rotation.z ?? hangAngleRef.current,
        rotX: 0,
        vx: (Math.random() - 0.3) * 0.45,
        vy: 0.2,
        vz: 0.4,
        wr: (Math.random() - 0.5) * 5,
      }
    }

    if (phase === 'intact') {
      rightPinStartedRef.current = false
      setPivotFromLeft(false)
      hangAngleRef.current = 0
      hangVelRef.current = 0
      fallRef.current.active = false
      if (photoGroupRef.current) {
        photoGroupRef.current.position.set(...BAG_POLAROID_CENTER)
        photoGroupRef.current.rotation.set(0, 0, 0)
      }
    }
  }, [phase, hangOne, rightPinLocal, leftPinLocal])

  useEffect(() => {
    if (!lastHitTime || lastHitTime === lastHitRef.current) return
    lastHitRef.current = lastHitTime
    if ((hangOne || pivotFromLeft) && !fallRef.current.active) {
      hangVelRef.current += 1.8 + Math.random() * 0.8
    }
  }, [lastHitTime, hangOne, pivotFromLeft])

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta)
    const g = photoGroupRef.current

    if (rightPinStartedRef.current && rightPinFallRef.current) {
      const p = rightPinPos.current
      const v = rightPinVel.current
      if (p.y > FLOOR_LOCAL_Y + 0.02 || Math.abs(v.y) > 0.02) {
        v.y -= 9.5 * dt
        p.x += v.x * dt
        p.y += v.y * dt
        p.z += v.z * dt
        p.rot += v.rot * dt
        v.x *= 0.995
        v.z *= 0.995
        if (p.y < FLOOR_LOCAL_Y + 0.02) {
          p.y = FLOOR_LOCAL_Y + 0.02
          v.y *= -0.18
          v.x *= 0.5
          v.rot *= 0.4
          if (Math.abs(v.y) < 0.04) v.y = 0
        }
        rightPinFallRef.current.position.set(p.x, p.y, Math.max(0.08, p.z))
        rightPinFallRef.current.rotation.z = p.rot
        rightPinFallRef.current.visible = true
      }
    } else if (rightPinFallRef.current) {
      rightPinFallRef.current.visible = false
    }

    if (!g) return

    if (fallRef.current.active) {
      const f = fallRef.current
      f.vy -= 9.5 * dt
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.z += f.vz * dt
      f.rotZ += f.wr * dt
      f.rotX += 0.9 * dt
      if (f.y <= FLOOR_LOCAL_Y) {
        f.y = FLOOR_LOCAL_Y
        f.vy *= -0.12
        f.vx *= 0.5
        f.vz *= 0.5
        f.wr *= 0.35
        if (Math.abs(f.vy) < 0.05) f.vy = 0
      }
      g.position.set(f.x, f.y, Math.max(0.12, f.z))
      g.rotation.set(Math.min(1.15, f.rotX), 0, f.rotZ)
      return
    }

    if (pivotFromLeft || hangOne) {
      const rest = 0.22
      const accel = -12 * Math.sin(hangAngleRef.current - rest)
      hangVelRef.current += accel * dt
      hangVelRef.current *= 0.985
      hangAngleRef.current += hangVelRef.current * dt
      hangAngleRef.current = THREE.MathUtils.clamp(hangAngleRef.current, -0.85, 1.1)

      const [px, py, pz] = BAG_POLAROID_CENTER
      const [lx, ly] = leftPinLocal
      g.position.set(px + lx, py + ly, pz)
      g.rotation.z = hangAngleRef.current
    } else {
      g.position.set(...BAG_POLAROID_CENTER)
      g.rotation.set(0, 0, 0)
    }
  })

  if (!texture) return null

  const usePivot = pivotFromLeft || hangOne
  const childOffset: [number, number, number] = usePivot
    ? [-leftPinLocal[0], -leftPinLocal[1], 0]
    : [0, 0, 0]

  /** Right pin stays on the photo only before the 40% pop. */
  const showRightPinOnPhoto = phase === 'intact' || phase === 'cornerTear'

  return (
    <>
      <group ref={photoGroupRef} position={BAG_POLAROID_CENTER} renderOrder={3}>
        <group position={childOffset}>
          <mesh renderOrder={3}>
            <planeGeometry args={[BAG_POLAROID_WIDTH, BAG_POLAROID_HEIGHT]} />
            <meshBasicMaterial
              map={texture}
              transparent
              opacity={opacity}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <PinHead position={leftPinLocal} opacity={opacity} />
          {showRightPinOnPhoto && <PinHead position={rightPinLocal} opacity={opacity} />}
        </group>
      </group>

      <group ref={rightPinFallRef} visible={false}>
        <PinHead position={[0, 0, 0]} opacity={opacity} />
      </group>
    </>
  )
}
