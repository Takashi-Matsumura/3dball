"use client";

import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const CELL_SIZE = 1.2;
const BALL_RADIUS = 0.4;

const PATTERN_NAMES = ["チェッカー", "ストライプ"] as const;

interface PatternConfig {
  pattern: number;
  color1: string;
  color2: string;
  scale: number; // 模様の幅 (1〜30)
}

function makeShaderMaterial(config: PatternConfig) {
  const fragmentShaders: Record<number, string> = {
    0: `
      uniform vec3 color1;
      uniform vec3 color2;
      uniform float scale;
      varying vec3 vPosition;
      void main() {
        float stripe = step(0.0, sin(vPosition.y * scale));
        float lng = atan(vPosition.z, vPosition.x);
        float stripeV = step(0.0, sin(lng * scale * 0.5));
        float pattern = mod(stripe + stripeV, 2.0);
        vec3 color = mix(color1, color2, pattern);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    1: `
      uniform vec3 color1;
      uniform vec3 color2;
      uniform float scale;
      varying vec3 vPosition;
      void main() {
        float stripe = smoothstep(0.45, 0.55, fract(vPosition.y * scale));
        vec3 color = mix(color1, color2, stripe);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  };

  return new THREE.ShaderMaterial({
    uniforms: {
      color1: { value: new THREE.Color(config.color1) },
      color2: { value: new THREE.Color(config.color2) },
      scale: { value: config.scale },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: fragmentShaders[config.pattern],
  });
}

const CAMERA_3D = {
  pos: [0, 3, 6] as const,
  lookAt: [0, 0, 0] as const,
  up: [0, 1, 0] as const,
};
const CAMERA_2D = {
  pos: [0, 7, 0] as const,
  lookAt: [0, 0, 0] as const,
  up: [0, 0, -1] as const, // -Z = screen up, so row=0 is at top, +X = right
};

function CameraController({ is2D }: { is2D: boolean }) {
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

function Board() {
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
      {/* Wooden frame border */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[frameSize, frameSize]} />
        <meshStandardMaterial color="#8B6914" roughness={0.7} />
      </mesh>
      {/* Board cells */}
      {cells}
    </>
  );
}

function Ground() {
  return (
    <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#1a1a24" roughness={1} />
    </mesh>
  );
}

interface AnimState {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  rotAxisX: number;
  rotAxisZ: number;
  progress: number;
}

function Sphere({
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

const NFC_DIRECTIONS = ["UP", "DOWN", "LEFT", "RIGHT"] as const;
const NFC_ICONS: Record<string, string> = { UP: "⬆", DOWN: "⬇", LEFT: "⬅", RIGHT: "➡" };

function moveGrid(
  prev: { col: number; row: number },
  direction: string,
): { col: number; row: number } | null {
  let { col, row } = prev;
  switch (direction) {
    case "UP":
      row = Math.max(0, row - 1);
      break;
    case "DOWN":
      row = Math.min(2, row + 1);
      break;
    case "LEFT":
      col = Math.max(0, col - 1);
      break;
    case "RIGHT":
      col = Math.min(2, col + 1);
      break;
    default:
      return null;
  }
  if (col === prev.col && row === prev.row) return null;
  return { col, row };
}

export default function Ball() {
  const [gridPos, setGridPos] = useState({ col: 1, row: 1 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [is2D, setIs2D] = useState(false);
  const [patternConfig, setPatternConfig] = useState<PatternConfig>({
    pattern: 0,
    color1: "#4488ff",
    color2: "#ffffff",
    scale: 20,
  });
  const [nfcConnected, setNfcConnected] = useState(false);
  const [nfcFlash, setNfcFlash] = useState<string | null>(null);
  const isAnimatingRef = useRef(false);

  // Keep ref in sync for NFC polling callback
  useEffect(() => { isAnimatingRef.current = isAnimating; }, [isAnimating]);

  // NFC polling
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/nfc/read");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setNfcConnected(data.connected);

        for (const ev of data.events) {
          const cardId = ev.cardId as string;
          if (!NFC_DIRECTIONS.includes(cardId as typeof NFC_DIRECTIONS[number])) continue;
          if (isAnimatingRef.current) continue;

          setGridPos((prev) => {
            const next = moveGrid(prev, cardId);
            if (!next) return prev;
            setIsAnimating(true);
            return next;
          });

          // Flash notification
          setNfcFlash(cardId);
          setTimeout(() => { if (!cancelled) setNfcFlash(null); }, 1000);
        }
      } catch {
        // ignore
      }
    };
    poll();
    const id = setInterval(poll, 400);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isAnimating) return;
      const keyMap: Record<string, string> = {
        ArrowUp: "UP",
        ArrowDown: "DOWN",
        ArrowLeft: "LEFT",
        ArrowRight: "RIGHT",
      };
      const direction = keyMap[e.key];
      if (!direction) return;
      e.preventDefault();
      setGridPos((prev) => {
        const next = moveGrid(prev, direction);
        if (!next) return prev;
        setIsAnimating(true);
        return next;
      });
    },
    [isAnimating]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="relative h-screen w-screen">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 w-56">
        <button
          onClick={() => setIs2D((v) => !v)}
          className="rounded-lg bg-white/90 px-4 py-2 text-sm font-medium text-black shadow-md backdrop-blur transition hover:bg-white"
        >
          {is2D ? "3D モード" : "2D モード"}
        </button>

        {/* Pattern panel */}
        <div className="rounded-lg bg-white/90 p-3 shadow-md backdrop-blur flex flex-col gap-2">
          {/* Pattern selector */}
          <div className="flex gap-1">
            {PATTERN_NAMES.map((name, i) => (
              <button
                key={name}
                onClick={() => setPatternConfig((c) => ({ ...c, pattern: i }))}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  i === patternConfig.pattern
                    ? "bg-black text-white"
                    : "bg-gray-100 text-black/70 hover:bg-gray-200"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Color pickers */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-black/60 w-10">色 1</label>
            <input
              type="color"
              value={patternConfig.color1}
              onChange={(e) => setPatternConfig((c) => ({ ...c, color1: e.target.value }))}
              className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
            />
            <label className="text-xs text-black/60 w-10 ml-2">色 2</label>
            <input
              type="color"
              value={patternConfig.color2}
              onChange={(e) => setPatternConfig((c) => ({ ...c, color2: e.target.value }))}
              className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
            />
          </div>

          {/* Scale slider */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-black/60 w-10">幅</label>
            <input
              type="range"
              min={2}
              max={20}
              step={1}
              value={patternConfig.scale}
              onChange={(e) => setPatternConfig((c) => ({ ...c, scale: Number(e.target.value) }))}
              className="flex-1"
            />
            <span className="text-xs text-black/60 w-6 text-right">{patternConfig.scale}</span>
          </div>
        </div>

        <a
          href="/nfc"
          className="rounded-lg bg-white/90 px-4 py-2 text-sm font-medium text-black shadow-md backdrop-blur transition hover:bg-white text-center"
        >
          NFC カード登録
        </a>
      </div>

      {/* NFC status */}
      <div className="absolute top-4 left-4 z-10">
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium shadow-md backdrop-blur ${
            nfcConnected
              ? "bg-green-500/80 text-white"
              : "bg-white/50 text-black/50"
          }`}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              nfcConnected ? "bg-white animate-pulse" : "bg-gray-400"
            }`}
          />
          {nfcConnected ? "NFC 接続中" : "NFC 未接続"}
        </div>
      </div>

      {/* NFC flash */}
      {nfcFlash && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="rounded-xl bg-white/90 px-4 py-3 shadow-xl backdrop-blur text-center animate-bounce">
            <div className="text-2xl">{NFC_ICONS[nfcFlash]}</div>
            <div className="text-xs font-bold text-gray-700">{nfcFlash}</div>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [0, 5, 5], fov: 45 }} gl={{ antialias: true }} shadows>
        <color attach="background" args={["#0d0d14"]} />
        <fog attach="fog" args={["#0d0d14", 8, 18]} />
        <CameraController is2D={is2D} />
        <ambientLight intensity={1.0} />
        <directionalLight
          position={[3, 6, 4]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
          shadow-bias={-0.002}
        />
        <pointLight position={[0, 3, 0]} intensity={0.3} color="#aaccff" />
        <Ground />
        <Board />
        <Sphere
          gridCol={gridPos.col}
          gridRow={gridPos.row}
          onAnimDone={() => setIsAnimating(false)}
          patternConfig={patternConfig}
        />
      </Canvas>
    </div>
  );
}
