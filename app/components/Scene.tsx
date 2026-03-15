"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  CELL_SIZE,
  BALL_RADIUS,
  CAMERA_3D,
  CAMERA_2D,
  makeShaderMaterial,
  PatternConfig,
} from "@/lib/ball-shared";

export function CameraController({ is2D }: { is2D: boolean }) {
  const { camera } = useThree();
  const target = is2D ? CAMERA_2D : CAMERA_3D;
  const currentPos = useRef(new THREE.Vector3(...CAMERA_3D.pos));
  const currentLookAt = useRef(new THREE.Vector3(...CAMERA_3D.lookAt));
  const currentUp = useRef(new THREE.Vector3(...CAMERA_3D.up));

  useFrame((_state, delta) => {
    const targetPos = new THREE.Vector3(...target.pos);
    const targetLookAt = new THREE.Vector3(...target.lookAt);
    const targetUp = new THREE.Vector3(...target.up);
    const speed = 4 * delta;

    currentPos.current.lerp(targetPos, speed);
    currentLookAt.current.lerp(targetLookAt, speed);
    currentUp.current.lerp(targetUp, speed).normalize();

    camera.position.copy(currentPos.current);
    camera.up.copy(currentUp.current);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}

export function Board() {
  const boardSize = CELL_SIZE * 3;
  const borderWidth = 0.15;
  const frameSize = boardSize + borderWidth * 2;

  const cells = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const isDark = (row + col) % 2 === 0;
      cells.push(
        <mesh
          key={`${row}-${col}`}
          position={[
            (col - 1) * CELL_SIZE,
            0.01,
            (row - 1) * CELL_SIZE,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[CELL_SIZE, CELL_SIZE]} />
          <meshStandardMaterial color={isDark ? "#555566" : "#e0d8c8"} />
        </mesh>
      );
    }
  }
  return (
    <>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[frameSize, frameSize]} />
        <meshStandardMaterial color="#8B6914" roughness={0.7} />
      </mesh>
      {cells}
    </>
  );
}

export function Ground() {
  return (
    <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#1a1a24" roughness={1} />
    </mesh>
  );
}

export interface AnimState {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  rotAxisX: number;
  rotAxisZ: number;
  progress: number;
}

export function Sphere({
  gridCol,
  gridRow,
  onAnimDone,
  patternConfig,
}: {
  gridCol: number;
  gridRow: number;
  onAnimDone: () => void;
  patternConfig: PatternConfig;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const animRef = useRef<AnimState | null>(null);
  const prevPos = useRef({ col: gridCol, row: gridRow });
  const cumulativeRotation = useRef(new THREE.Quaternion());

  const ANIM_SPEED = 4;

  useEffect(() => {
    const prevCol = prevPos.current.col;
    const prevRow = prevPos.current.row;
    if (prevCol === gridCol && prevRow === gridRow) return;

    const fromX = (prevCol - 1) * CELL_SIZE;
    const fromZ = (prevRow - 1) * CELL_SIZE;
    const toX = (gridCol - 1) * CELL_SIZE;
    const toZ = (gridRow - 1) * CELL_SIZE;

    const dx = gridCol - prevCol;
    const dz = gridRow - prevRow;

    animRef.current = {
      fromX,
      fromZ,
      toX,
      toZ,
      rotAxisX: dz,
      rotAxisZ: -dx,
      progress: 0,
    };

    prevPos.current = { col: gridCol, row: gridRow };
  }, [gridCol, gridRow]);

  useFrame((_state, delta) => {
    const anim = animRef.current;
    if (!anim || !groupRef.current || !innerRef.current) {
      return;
    }

    anim.progress += delta * ANIM_SPEED;
    const t = Math.min(anim.progress, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const x = anim.fromX + (anim.toX - anim.fromX) * eased;
    const z = anim.fromZ + (anim.toZ - anim.fromZ) * eased;
    groupRef.current.position.set(x, BALL_RADIUS, z);

    const totalDist = Math.sqrt(
      (anim.toX - anim.fromX) ** 2 + (anim.toZ - anim.fromZ) ** 2
    );
    const totalAngle = totalDist / BALL_RADIUS;
    const currentAngle = totalAngle * eased;

    const axis = new THREE.Vector3(anim.rotAxisX, 0, anim.rotAxisZ).normalize();
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(axis, currentAngle);
    const combined = rollQuat.multiply(cumulativeRotation.current.clone());
    innerRef.current.quaternion.copy(combined);

    if (t >= 1) {
      cumulativeRotation.current.copy(innerRef.current.quaternion);
      animRef.current = null;
      onAnimDone();
    }
  });

  const material = useMemo(() => makeShaderMaterial(patternConfig), [patternConfig]);

  const initX = (gridCol - 1) * CELL_SIZE;
  const initZ = (gridRow - 1) * CELL_SIZE;

  return (
    <group ref={groupRef} position={[initX, BALL_RADIUS, initZ]}>
      <group ref={innerRef}>
        <mesh material={material} castShadow>
          <sphereGeometry args={[BALL_RADIUS, 64, 64]} />
        </mesh>
      </group>
    </group>
  );
}
