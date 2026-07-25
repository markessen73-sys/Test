import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { loadFaceImage } from './composeFaceTexture'
import {
  drawPolaroidOnCanvas,
  POLAROID_CANVAS_SIZE,
  renderPolaroidScrapCanvas,
} from './composePolaroidTexture'
import { FACE_TEMPLATE_SRC } from './faceTemplate'
import {
  BAG_POLAROID_CENTER,
  BAG_POLAROID_HEIGHT,
  BAG_POLAROID_PIN_INSET,
  BAG_POLAROID_PIN_RADIUS,
  BAG_POLAROID_WIDTH,
  bagPolaroidHangsByOnePin,
  bagPolaroidPhaseForStage,
  type BagPolaroidPhase,
  type PolaroidScrapKind,
} from './bagPolaroid'

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

type FallingScrap = {
  id: PolaroidScrapKind
  /** Bag-local pose — starts matched to the photo, then falls. */
  x: number
  y: number
  z: number
  rotZ: number
  rotX: number
  vx: number
  vy: number
  vz: number
  wr: number
  texture: THREE.CanvasTexture
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
 * B&W Polaroid of the selected face, pinned to the heavy bag.
 * Tear scraps are real photo pieces that peel off from the Polaroid pose.
 */
export function BagPolaroid({ stage, lastHitTime = 0, opacity = 1 }: BagPolaroidProps) {
  const phase = bagPolaroidPhaseForStage(stage)
  const hangOne = bagPolaroidHangsByOnePin(phase)
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

  const scrapsRef = useRef<FallingScrap[]>([])
  const [scrapIds, setScrapIds] = useState<PolaroidScrapKind[]>([])
  const spawnedScrapsRef = useRef<Set<PolaroidScrapKind>>(new Set())

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

  /** Current bag-local pose of the Polaroid plane centre (+ rotation). */
  const photoPose = () => {
    const usePivot = pivotFromLeft || hangOne
    const angle = hangAngleRef.current
    if (!usePivot || fallRef.current.active) {
      const g = photoGroupRef.current
      return {
        x: g?.position.x ?? BAG_POLAROID_CENTER[0],
        y: g?.position.y ?? BAG_POLAROID_CENTER[1],
        z: g?.position.z ?? BAG_POLAROID_CENTER[2],
        rotZ: g?.rotation.z ?? 0,
      }
    }
    const [px, py, pz] = BAG_POLAROID_CENTER
    const [lx, ly] = leftPinLocal
    // Group at left pin; photo centre = pin + R * (-leftPinLocal).
    const ox = -lx
    const oy = -ly
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    return {
      x: px + lx + c * ox - s * oy,
      y: py + ly + s * ox + c * oy,
      z: pz,
      rotZ: angle,
    }
  }

  const spawnScrap = (kind: PolaroidScrapKind) => {
    if (spawnedScrapsRef.current.has(kind)) return
    const img = imgRef.current
    if (!img) return
    spawnedScrapsRef.current.add(kind)

    const scrapCanvas = renderPolaroidScrapCanvas(img, kind)
    const scrapTex = new THREE.CanvasTexture(scrapCanvas)
    scrapTex.colorSpace = THREE.SRGBColorSpace

    const pose = photoPose()
    const outward =
      kind === 'cornerL' ? { vx: -0.55, vz: 0.55, wr: -4 } :
      kind === 'cornerR' ? { vx: 0.6, vz: 0.5, wr: 4 } :
      { vx: -0.7, vz: 0.65, wr: -5 }

    scrapsRef.current.push({
      id: kind,
      x: pose.x,
      y: pose.y,
      z: pose.z + 0.02,
      rotZ: pose.rotZ,
      rotX: 0,
      vx: outward.vx,
      vy: 0.35,
      vz: outward.vz,
      wr: outward.wr,
      texture: scrapTex,
    })
    setScrapIds(scrapsRef.current.map((s) => s.id))
  }

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

  const syncScrapsForPhase = (p: BagPolaroidPhase) => {
    // Spawn scrap first (from current pose + intact scrap art), then punch the hole.
    if (p === 'cornerTear' || p === 'onePin' || p === 'bothCorners' || p === 'halfTear' || p === 'fallen') {
      spawnScrap('cornerL')
    }
    if (p === 'bothCorners' || p === 'halfTear' || p === 'fallen') {
      spawnScrap('cornerR')
    }
    if (p === 'halfTear' || p === 'fallen') {
      spawnScrap('half')
    }
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

    loadFaceImage(FACE_TEMPLATE_SRC).then((img) => {
      if (cancelled) return
      imgRef.current = img
      syncScrapsForPhase(phaseRef.current)
      paint(phaseRef.current)
    })

    return () => {
      cancelled = true
      tex.dispose()
      for (const scrap of scrapsRef.current) scrap.texture.dispose()
    }
  }, [])

  useEffect(() => {
    syncScrapsForPhase(phase)
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
      const pose = photoPose()
      // Right pin in photo-local → bag-local using current photo pose.
      const [rx, ry] = rightPinLocal
      const c = Math.cos(pose.rotZ)
      const s = Math.sin(pose.rotZ)
      rightPinPos.current = {
        x: pose.x + c * rx - s * ry,
        y: pose.y + s * rx + c * ry,
        z: pose.z + 0.02,
        rot: 0,
      }
      rightPinVel.current = {
        x: 0.3 + Math.random() * 0.15,
        y: 0.55,
        z: 0.4,
        rot: 3 + Math.random() * 2,
      }
    }

    if (phase === 'fallen' && !fallRef.current.active) {
      const pose = photoPose()
      fallRef.current = {
        active: true,
        x: pose.x,
        y: pose.y,
        z: pose.z,
        rotZ: pose.rotZ,
        rotX: 0,
        vx: (Math.random() - 0.3) * 0.45,
        vy: 0.2,
        vz: 0.4,
        wr: (Math.random() - 0.5) * 5,
      }
      // Switch group out of pin-pivot child offset for a clean centre fall.
      setPivotFromLeft(false)
    }

    if (phase === 'intact') {
      rightPinStartedRef.current = false
      setPivotFromLeft(false)
      hangAngleRef.current = 0
      hangVelRef.current = 0
      fallRef.current.active = false
      for (const scrap of scrapsRef.current) scrap.texture.dispose()
      scrapsRef.current = []
      spawnedScrapsRef.current.clear()
      setScrapIds([])
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

    for (const scrap of scrapsRef.current) {
      scrap.vy -= 9.5 * dt
      scrap.x += scrap.vx * dt
      scrap.y += scrap.vy * dt
      scrap.z += scrap.vz * dt
      scrap.rotZ += scrap.wr * dt
      scrap.rotX += 1.2 * dt
      scrap.vx *= 0.995
      scrap.vz *= 0.995
      if (scrap.y < FLOOR_LOCAL_Y + 0.01) {
        scrap.y = FLOOR_LOCAL_Y + 0.01
        scrap.vy *= -0.12
        scrap.vx *= 0.45
        scrap.vz *= 0.45
        scrap.wr *= 0.3
        scrap.rotX = Math.min(scrap.rotX, 1.2)
        if (Math.abs(scrap.vy) < 0.04) scrap.vy = 0
      }
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

  const usePivot = (pivotFromLeft || hangOne) && !fallRef.current.active
  const childOffset: [number, number, number] = usePivot
    ? [-leftPinLocal[0], -leftPinLocal[1], 0]
    : [0, 0, 0]

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

      {scrapIds.map((id) => {
        const scrap = scrapsRef.current.find((s) => s.id === id)
        if (!scrap) return null
        return <FallingScrapMesh key={id} scrap={scrap} opacity={opacity} />
      })}
    </>
  )
}

/** Full-size Polaroid scrap — texture is only the torn piece, rest transparent. */
function FallingScrapMesh({ scrap, opacity }: { scrap: FallingScrap; opacity: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (!ref.current) return
    ref.current.position.set(scrap.x, scrap.y, Math.max(0.06, scrap.z))
    ref.current.rotation.set(Math.min(1.25, scrap.rotX), 0, scrap.rotZ)
  })
  return (
    <mesh ref={ref} renderOrder={4}>
      <planeGeometry args={[BAG_POLAROID_WIDTH, BAG_POLAROID_HEIGHT]} />
      <meshBasicMaterial
        map={scrap.texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
