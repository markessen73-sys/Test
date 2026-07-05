import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { StationInfo } from '../types/game';

interface CameraRigProps {
  station: StationInfo;
}

export function CameraRig({ station }: CameraRigProps) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(...station.cameraPos));
  const targetLook = useRef(new THREE.Vector3(...station.lookAt));
  const currentLook = useRef(new THREE.Vector3(...station.lookAt));

  // Snap targets when station changes
  targetPos.current.set(...station.cameraPos);
  targetLook.current.set(...station.lookAt);

  useFrame((_, delta) => {
    const t = Math.min(1, delta * 2.5);
    camera.position.lerp(targetPos.current, t);
    currentLook.current.lerp(targetLook.current, t);
    camera.lookAt(currentLook.current);
  });

  return null;
}
