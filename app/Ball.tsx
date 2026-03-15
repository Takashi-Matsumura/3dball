"use client";

import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useI18n, Locale } from "@/lib/i18n";

const CELL_SIZE = 1.2;
const BALL_RADIUS = 0.4;

const COLOR_PRESETS = [
  "#ff0000", "#ff8800", "#ffcc00", "#00cc00", "#0088ff",
  "#4488ff", "#8844ff", "#ff44aa", "#ffffff", "#000000",
];

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
  const { locale, setLocale, t } = useI18n();
  const [gridPos, setGridPos] = useState({ col: 1, row: 1 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [is2D, setIs2D] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [patternConfig, setPatternConfig] = useState<PatternConfig>({
    pattern: 0,
    color1: "#4488ff",
    color2: "#ffffff",
    scale: 20,
  });
  const [nfcConnected, setNfcConnected] = useState(false);
  const [nfcFlash, setNfcFlash] = useState<string | null>(null);
  const isAnimatingRef = useRef(false);

  // Programming mode
  const [progMode, setProgMode] = useState(false);
  const [program, setProgram] = useState<string[]>([]);
  const [progRunning, setProgRunning] = useState(false);
  const [progIndex, setProgIndex] = useState(-1);
  const progModeRef = useRef(false);
  const progStepsRef = useRef<HTMLDivElement>(null);
  const progRunningRef = useRef(false);

  useEffect(() => { progModeRef.current = progMode; }, [progMode]);
  useEffect(() => { progRunningRef.current = progRunning; }, [progRunning]);

  // Auto-scroll to highlighted step
  useEffect(() => {
    if (progIndex < 0 || !progStepsRef.current) return;
    const el = progStepsRef.current.children[progIndex] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [progIndex]);

  // Keep ref in sync for NFC polling callback
  useEffect(() => { isAnimatingRef.current = isAnimating; }, [isAnimating]);

  // Run program step by step
  const animDoneResolveRef = useRef<(() => void) | null>(null);

  const runProgram = useCallback(async () => {
    if (program.length === 0) return;
    setProgRunning(true);
    // Reset ball to center
    setGridPos({ col: 1, row: 1 });
    setIsAnimating(false);
    // Wait a frame for reset
    await new Promise((r) => setTimeout(r, 100));

    let currentPos = { col: 1, row: 1 };
    for (let i = 0; i < program.length; i++) {
      setProgIndex(i);
      const direction = program[i];
      const next = moveGrid(currentPos, direction);
      if (next) {
        currentPos = next;
        setIsAnimating(true);
        setGridPos(next);
        // Wait for animation to complete
        await new Promise<void>((resolve) => {
          animDoneResolveRef.current = resolve;
        });
      }
      // Small pause between steps
      await new Promise((r) => setTimeout(r, 200));
    }
    setProgIndex(-1);
    setProgRunning(false);
  }, [program]);

  const handleAnimDone = useCallback(() => {
    setIsAnimating(false);
    if (animDoneResolveRef.current) {
      animDoneResolveRef.current();
      animDoneResolveRef.current = null;
    }
  }, []);

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

          // Programming mode: add to program instead of moving
          if (progModeRef.current && !progRunningRef.current) {
            setProgram((prev) => [...prev, cardId]);
            setNfcFlash(cardId);
            setTimeout(() => { if (!cancelled) setNfcFlash(null); }, 500);
            continue;
          }

          // Normal mode: move ball directly
          if (progModeRef.current) continue; // skip during run
          if (isAnimatingRef.current) continue;

          setGridPos((prev) => {
            const next = moveGrid(prev, cardId);
            if (!next) return prev;
            setIsAnimating(true);
            return next;
          });

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
      if (progMode || isAnimating) return;
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
    [isAnimating, progMode]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="relative h-screen w-screen">
      {/* Programming panel — left */}
      <div className="absolute top-4 left-4 z-10">
        {/* Panel header */}
        {!progMode ? (
          <button
            onClick={() => setProgMode(true)}
            className="rounded-lg bg-white/95 p-2 shadow-md backdrop-blur border border-gray-200 transition hover:bg-white text-black/40 hover:text-black/70"
            title={t("programming")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
        ) : (
          <div className="w-52 flex items-center bg-white/95 rounded-lg shadow-md backdrop-blur border border-gray-200 overflow-hidden">
            <span className="flex-1 px-3 py-2 text-sm font-bold text-gray-700">{t("programming")}</span>
            <button
              onClick={() => {
                setProgMode(false);
                setProgram([]);
                setProgIndex(-1);
                setProgRunning(false);
              }}
              className="px-3 py-2 transition border-l border-gray-200 bg-yellow-400 hover:bg-yellow-300 text-black/70"
              title={t("close")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Panel body */}
        {progMode && (
          <div className="mt-1 flex flex-col bg-white/95 rounded-lg shadow-md backdrop-blur border border-gray-200 overflow-hidden" style={{ maxHeight: "calc(100vh - 8rem)" }}>
            {/* New button */}
            <button
              onClick={() => {
                setProgram([]);
                setProgIndex(-1);
                setGridPos({ col: 1, row: 1 });
              }}
              disabled={progRunning}
              className="px-4 py-2 text-sm font-bold text-white bg-gray-600 hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              New
            </button>

            {/* Program steps */}
            <div ref={progStepsRef} className="flex-1 overflow-y-auto min-h-[120px] px-2 py-2 flex flex-col gap-1">
              {program.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8 whitespace-pre-line">
                  {t("scanCardToAdd")}
                </p>
              ) : (
                program.map((dir, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      progIndex === i
                        ? "bg-yellow-300 scale-105"
                        : "bg-gray-100"
                    }`}
                  >
                    <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                    <span className="text-lg">{NFC_ICONS[dir]}</span>
                    <span className="text-xs text-gray-600">{dir}</span>
                    {!progRunning && (
                      <button
                        onClick={() => setProgram((p) => p.filter((_, j) => j !== i))}
                        className="ml-auto text-gray-400 hover:text-red-500 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Run button */}
            <button
              onClick={runProgram}
              disabled={progRunning || program.length === 0}
              className={`px-4 py-2 text-sm font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${
                progRunning
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {progRunning ? t("running") : t("run")}
            </button>
          </div>
        )}
      </div>

      {/* Settings panel — right */}
      <div className="absolute top-4 right-4 z-10">
        {/* Panel header */}
        {!showSettings ? (
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg bg-white/95 p-2 shadow-md backdrop-blur border border-gray-200 transition hover:bg-white text-black/40 hover:text-black/70"
            title={t("settings")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        ) : (
          <div className="w-52 flex items-center bg-white/95 rounded-lg shadow-md backdrop-blur border border-gray-200 overflow-hidden">
            <span className="flex-1 px-3 py-2 text-sm font-bold text-gray-700">{t("settings")}</span>
            <button
              onClick={() => setShowSettings(false)}
              className="px-3 py-2 transition border-l border-gray-200 bg-gray-200 hover:bg-gray-300 text-black/70"
              title={t("close")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Panel body */}
        {showSettings && (
          <div className="mt-1 w-52 flex flex-col gap-2">
            <button
              onClick={() => setIs2D((v) => !v)}
              className="rounded-lg bg-white/95 px-4 py-2 text-sm font-medium text-black shadow-md backdrop-blur border border-gray-200 transition hover:bg-white"
            >
              {is2D ? t("mode3D") : t("mode2D")}
            </button>

            <div className="rounded-lg bg-white/95 p-3 shadow-md backdrop-blur border border-gray-200 flex flex-col gap-2">
              <div className="flex gap-1">
                {([["checker", 0], ["stripe", 1]] as const).map(([key, i]) => (
                  <button
                    key={key}
                    onClick={() => setPatternConfig((c) => ({ ...c, pattern: i }))}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                      i === patternConfig.pattern
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black/70 hover:bg-gray-200"
                    }`}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>

              {[["color1", patternConfig.color1] as const, ["color2", patternConfig.color2] as const].map(([key, value]) => (
                <div key={key}>
                  <label className="text-xs text-black/60">{t(key)}</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setPatternConfig((prev) => ({ ...prev, [key]: c }))}
                        className={`w-6 h-6 rounded-md border-2 transition ${
                          value === c ? "border-black scale-110" : "border-transparent hover:border-gray-400"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <label className="text-xs text-black/60 w-10">{t("width")}</label>
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
              className="rounded-lg bg-white/95 px-4 py-2 text-sm font-medium text-black shadow-md backdrop-blur border border-gray-200 transition hover:bg-white text-center"
            >
              {t("nfcCardRegister")}
            </a>

            <div className="rounded-lg bg-white/95 p-3 shadow-md backdrop-blur border border-gray-200 flex flex-col gap-1">
              <label className="text-xs text-black/60 mb-1">{t("language")}</label>
              <div className="flex gap-1">
                {(["ja", "en"] as Locale[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLocale(lang)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                      locale === lang
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black/70 hover:bg-gray-200"
                    }`}
                  >
                    {lang === "ja" ? "日本語" : "English"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer — NFC status */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center px-4 py-2 bg-black/50 backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-medium text-white/80">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              nfcConnected ? "bg-green-400 animate-pulse" : "bg-gray-500"
            }`}
          />
          {nfcConnected ? t("nfcConnected") : t("nfcDisconnected")}
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
          onAnimDone={handleAnimDone}
          patternConfig={patternConfig}
        />
      </Canvas>
    </div>
  );
}
