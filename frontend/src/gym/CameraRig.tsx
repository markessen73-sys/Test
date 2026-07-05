import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CameraShot } from '../types/game';

interface CameraRigProps {
  shot: CameraShot;
}

export function CameraRig({ shot }: CameraRigProps) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(...shot.position));
  const targetLook = useRef(new THREE.Vector3(...shot.lookAt));
  const currentLook = useRef(new THREE.Vector3(...shot.lookAt));

  useEffect(() => {
    targetPos.current.set(...shot.position);
    targetLook.current.set(...shot.lookAt);
  }, [shot.position, shot.lookAt, shot.fov]);

  useFrame((_, delta) => {
    const t = Math.min(1, delta * 2.2);
    camera.position.lerp(targetPos.current, t);
    currentLook.current.lerp(targetLook.current, t);
    camera.lookAt(currentLook.current);

    if ('fov' in camera && camera instanceof THREE.PerspectiveCamera) {
      camera.fov += (shot.fov - camera.fov) * t;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
