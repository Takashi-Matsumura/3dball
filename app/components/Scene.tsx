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
  const { camera, size } = useThree();
  const target = is2D ? CAMERA_2D : CAMERA_3D;
  const currentPos = useRef(new THREE.Vector3(...CAMERA_3D.pos));
  const currentLookAt = useRef(new THREE.Vector3(...CAMERA_3D.lookAt));
  const currentUp = useRef(new THREE.Vector3(...CAMERA_3D.up));

  useFrame((_state, delta) => {
    const aspect = size.width / size.height;
    // Pull camera back for portrait screens so the full board is visible
    const scale = aspect < 1 ? 1 / aspect : 1;

    const basePos = new THREE.Vector3(...target.pos);
    const lookAt = new THREE.Vector3(...target.lookAt);
    // Scale the offset from lookAt point
    const offset = basePos.clone().sub(lookAt).multiplyScalar(scale);
    const targetPos = lookAt.clone().add(offset);

    const targetUp = new THREE.Vector3(...target.up);
    const speed = 4 * delta;

    currentPos.current.lerp(targetPos, speed);
    currentLookAt.current.lerp(lookAt, speed);
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

/** Pulsing ring marker for start/goal cells */
export function CellMarker({
  col,
  row,
  color,
}: {
  col: number;
  row: number;
  color: string;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!ringRef.current || !glowRef.current) return;
    const t = performance.now() / 1000;
    ringRef.current.scale.setScalar(0.8 + 0.2 * Math.sin(t * 3));
    (glowRef.current.material as THREE.MeshStandardMaterial).opacity = 0.15 + 0.1 * Math.sin(t * 3);
  });

  const x = (col - 1) * CELL_SIZE;
  const z = (row - 1) * CELL_SIZE;

  return (
    <group position={[x, 0.02, z]}>
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[CELL_SIZE * 0.45, 32]} />
        <meshStandardMaterial color={color} transparent opacity={0.2} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[CELL_SIZE * 0.3, CELL_SIZE * 0.4, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

/** Canvas-based text sprite for start/goal labels */
export function TextSprite({
  col,
  row,
  text,
  color,
}: {
  col: number;
  row: number;
  text: string;
  color: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 128, 64);
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, 64, 32);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, [text, color]);

  const x = (col - 1) * CELL_SIZE;
  const z = (row - 1) * CELL_SIZE;

  return (
    <sprite position={[x, 0.8, z]} scale={[0.7, 0.35, 1]}>
      <spriteMaterial map={texture} transparent />
    </sprite>
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
  jumping,
  onAnimDone,
  onJumpDone,
  patternConfig,
}: {
  gridCol: number;
  gridRow: number;
  jumping?: boolean;
  onAnimDone: () => void;
  onJumpDone?: () => void;
  patternConfig: PatternConfig;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const animRef = useRef<AnimState | null>(null);
  const jumpRef = useRef<{ bounce: number; progress: number } | null>(null);
  const prevPos = useRef({ col: gridCol, row: gridRow });
  const cumulativeRotation = useRef(new THREE.Quaternion());

  const ANIM_SPEED = 4;
  const JUMP_SPEED = 3;
  const JUMP_HEIGHT = BALL_RADIUS * 2.5;
  const BOUNCE_COUNT = 3;

  // Start jump animation
  useEffect(() => {
    if (jumping && !jumpRef.current) {
      jumpRef.current = { bounce: 0, progress: 0 };
    }
  }, [jumping]);

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
    if (!groupRef.current || !innerRef.current) return;

    // Jump animation with bounces
    const jump = jumpRef.current;
    let jumpY = 0;
    if (jump) {
      // Each bounce gets smaller: height * (0.4 ^ bounce)
      const heightScale = Math.pow(0.4, jump.bounce);
      const bounceHeight = JUMP_HEIGHT * heightScale;
      // Each bounce gets faster
      const speedScale = 1 + jump.bounce * 0.5;

      jump.progress += delta * JUMP_SPEED * speedScale;
      const jt = Math.min(jump.progress, 1);
      // Parabolic arc
      jumpY = bounceHeight * 4 * jt * (1 - jt);

      if (jt >= 1) {
        jump.bounce++;
        if (jump.bounce >= BOUNCE_COUNT) {
          jumpRef.current = null;
          jumpY = 0;
          onJumpDone?.();
        } else {
          jump.progress = 0;
          jumpY = 0;
        }
      }
    }

    // Move animation
    const anim = animRef.current;
    if (!anim) {
      // Update Y for jump even when not moving
      groupRef.current.position.y = BALL_RADIUS + jumpY;
      return;
    }

    anim.progress += delta * ANIM_SPEED;
    const t = Math.min(anim.progress, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const x = anim.fromX + (anim.toX - anim.fromX) * eased;
    const z = anim.fromZ + (anim.toZ - anim.fromZ) * eased;
    groupRef.current.position.set(x, BALL_RADIUS + jumpY, z);

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
