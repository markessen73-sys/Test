import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { loadFaceImage } from './composeFaceTexture'
import {
  drawPolaroidOnCanvas,
  POLAROID_CANVAS_SIZE,
  renderPolaroidScrap,
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
  x: number
  y: number
  z: number
  rotZ: number
  rotX: number
  vx: number
  vy: number
  vz: number
  wr: number
  stick: number
  mesh: THREE.Mesh
  texture: THREE.CanvasTexture
  geo: THREE.PlaneGeometry
  mat: THREE.MeshBasicMaterial
}

interface BagPolaroidProps {
  stage: number
  lastHitTime?: number
  opacity?: number
}

/**
 * B&W Polaroid of the selected face, pinned to the heavy bag.
 * Tear scraps are real photo pieces that peel off from the hole.
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
  const opacityRef = useRef(opacity)
  opacityRef.current = opacity

  const photoGroupRef = useRef<THREE.Group>(null)
  const scrapsGroupRef = useRef<THREE.Group>(null)
  const hangAngleRef = useRef(0)
  const hangVelRef = useRef(0)
  const lastHitRef = useRef(0)

  const rightPinFallRef = useRef<THREE.Group>(null)
  const rightPinStartedRef = useRef(false)
  const rightPinVel = useRef({ x: 0.15, y: 0.4, z: 0.2, rot: 2.5 })
  const rightPinPos = useRef({ x: 0, y: 0, z: 0, rot: 0 })

  const scrapsRef = useRef<FallingScrap[]>([])
  const spawnedScrapsRef = useRef<Set<PolaroidScrapKind>>(new Set())
  /** Retry scrap sync until the image + scraps group are both ready. */
  const needsScrapSyncRef = useRef(true)

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

  const clearScraps = () => {
    const group = scrapsGroupRef.current
    for (const scrap of scrapsRef.current) {
      group?.remove(scrap.mesh)
      scrap.geo.dispose()
      scrap.mat.dispose()
      scrap.texture.dispose()
    }
    scrapsRef.current = []
    spawnedScrapsRef.current.clear()
  }

  const photoPose = () => {
    const usePivot = (pivotFromLeft || hangOne) && !fallRef.current.active
    const angle = hangAngleRef.current
    if (!usePivot) {
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
    const group = scrapsGroupRef.current
    if (!img || !group) return
    spawnedScrapsRef.current.add(kind)

    const rendered = renderPolaroidScrap(img, kind)
    const scrapTex = new THREE.CanvasTexture(rendered.canvas)
    scrapTex.colorSpace = THREE.SRGBColorSpace
    scrapTex.needsUpdate = true

    // Slightly oversized so the falling piece reads clearly.
    const w = rendered.planeW * BAG_POLAROID_WIDTH * 1.15
    const h = rendered.planeH * BAG_POLAROID_HEIGHT * 1.15
    const geo = new THREE.PlaneGeometry(w, h)
    scrapTex.premultiplyAlpha = false
    scrapTex.needsUpdate = true
    const mat = new THREE.MeshBasicMaterial({
      map: scrapTex,
      transparent: true,
      opacity: opacityRef.current,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.renderOrder = 10
    mesh.frustumCulled = false

    const pose = photoPose()
    const ox = rendered.localX * BAG_POLAROID_WIDTH
    const oy = rendered.localY * BAG_POLAROID_HEIGHT
    const c = Math.cos(pose.rotZ)
    const s = Math.sin(pose.rotZ)
    const x = pose.x + c * ox - s * oy
    const y = pose.y + s * ox + c * oy
    // Sit clearly in front of the Polaroid plane.
    const z = pose.z + 0.08
    mesh.position.set(x, y, z)
    mesh.rotation.z = pose.rotZ
    group.add(mesh)

    // Mild peel toward camera — keep scraps in front of the bag, not past the lens.
    const outward =
      kind === 'cornerL' ? { vx: -0.35, vz: 0.55, wr: -2.5 } :
      kind === 'cornerR' ? { vx: 0.4, vz: 0.55, wr: 2.5 } :
      { vx: -0.25, vz: 0.65, wr: -2.8 }

    scrapsRef.current.push({
      id: kind,
      x,
      y,
      z,
      rotZ: pose.rotZ,
      rotX: 0,
      vx: outward.vx,
      vy: 0.35,
      vz: outward.vz,
      wr: outward.wr,
      stick: 0.28,
      mesh,
      texture: scrapTex,
      geo,
      mat,
    })
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
      needsScrapSyncRef.current = true
      paint(phaseRef.current)
    })

    return () => {
      cancelled = true
      tex.dispose()
      clearScraps()
    }
  }, [])

  useEffect(() => {
    needsScrapSyncRef.current = true
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
        z: 0.5,
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
        vz: 0.5,
        wr: (Math.random() - 0.5) * 5,
      }
      setPivotFromLeft(false)
    }

    if (phase === 'intact') {
      rightPinStartedRef.current = false
      setPivotFromLeft(false)
      hangAngleRef.current = 0
      hangVelRef.current = 0
      fallRef.current.active = false
      clearScraps()
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

  useEffect(() => {
    for (const scrap of scrapsRef.current) {
      scrap.mat.opacity = opacity
    }
  }, [opacity])

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta)
    const g = photoGroupRef.current

    if (needsScrapSyncRef.current && imgRef.current && scrapsGroupRef.current) {
      needsScrapSyncRef.current = false
      syncScrapsForPhase(phaseRef.current)
      paint(phaseRef.current)
    }

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
      if (scrap.stick > 0) {
        scrap.stick -= dt
        scrap.mesh.position.set(scrap.x, scrap.y, scrap.z)
        scrap.mesh.rotation.set(0, 0, scrap.rotZ)
        continue
      }
      scrap.vy -= 9.5 * dt
      scrap.x += scrap.vx * dt
      scrap.y += scrap.vy * dt
      scrap.z += scrap.vz * dt
      scrap.rotZ += scrap.wr * dt
      // Gentle tumble — stay mostly camera-facing so the scrap stays readable.
      scrap.rotX = Math.min(0.85, scrap.rotX + 0.7 * dt)
      scrap.vx *= 0.99
      scrap.vz *= 0.98
      scrap.z = THREE.MathUtils.clamp(scrap.z, 0.2, 1.35)
      if (scrap.y < FLOOR_LOCAL_Y + 0.04) {
        scrap.y = FLOOR_LOCAL_Y + 0.04
        scrap.vy *= -0.08
        scrap.vx *= 0.35
        scrap.vz *= 0.1
        scrap.wr *= 0.15
        // Lean toward camera on the floor (not flat / edge-on).
        scrap.rotX = 0.55
        scrap.z = THREE.MathUtils.clamp(Math.max(scrap.z, 0.7), 0.55, 1.25)
        if (Math.abs(scrap.vy) < 0.04) scrap.vy = 0
      }
      scrap.mesh.position.set(scrap.x, scrap.y, scrap.z)
      scrap.mesh.rotation.set(Math.min(1.35, scrap.rotX), 0, scrap.rotZ)
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

  const usePivot = (pivotFromLeft || hangOne) && !fallRef.current.active
  const childOffset: [number, number, number] = usePivot
    ? [-leftPinLocal[0], -leftPinLocal[1], 0]
    : [0, 0, 0]

  const showRightPinOnPhoto = phase === 'intact' || phase === 'cornerTear'

  return (
    <>
      <group ref={photoGroupRef} position={BAG_POLAROID_CENTER} renderOrder={3}>
        <group position={childOffset}>
          {texture && (
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
          )}
          <PinHead position={leftPinLocal} opacity={opacity} />
          {showRightPinOnPhoto && <PinHead position={rightPinLocal} opacity={opacity} />}
        </group>
      </group>

      <group ref={rightPinFallRef} visible={false}>
        <PinHead position={[0, 0, 0]} opacity={opacity} />
      </group>

      {/* Imperative scrap meshes peel from the photo into this group. */}
      <group ref={scrapsGroupRef} />
    </>
  )
}
