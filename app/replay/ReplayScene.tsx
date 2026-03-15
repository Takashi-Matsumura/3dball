"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import {
  PatternConfig,
  NFC_ICONS,
  moveGrid,
} from "@/lib/ball-shared";
import { CameraController, Board, Ground, Sphere } from "@/app/components/Scene";

interface ReplaySceneProps {
  steps: string[];
  color1?: string;
  color2?: string;
  scale?: number;
  pattern?: number;
  createdAt?: number;
}

export default function ReplayScene({ steps, color1, color2, scale, pattern, createdAt }: ReplaySceneProps) {
  const [gridPos, setGridPos] = useState({ col: 1, row: 1 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [is2D, setIs2D] = useState(false);
  const [progIndex, setProgIndex] = useState(-1);
  const [finished, setFinished] = useState(false);
  const animDoneResolveRef = useRef<(() => void) | null>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  const patternConfig: PatternConfig = {
    pattern: pattern ?? 0,
    color1: color1 || "#4488ff",
    color2: color2 || "#ffffff",
    scale: scale ?? 20,
  };

  // Auto-scroll to highlighted step
  useEffect(() => {
    if (progIndex < 0 || !stepsRef.current) return;
    const el = stepsRef.current.children[progIndex] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [progIndex]);

  const handleAnimDone = useCallback(() => {
    setIsAnimating(false);
    if (animDoneResolveRef.current) {
      animDoneResolveRef.current();
      animDoneResolveRef.current = null;
    }
  }, []);

  const runProgram = useCallback(async () => {
    setFinished(false);
    setGridPos({ col: 1, row: 1 });
    setIsAnimating(false);
    setProgIndex(-1);
    await new Promise((r) => setTimeout(r, 100));

    let currentPos = { col: 1, row: 1 };
    for (let i = 0; i < steps.length; i++) {
      setProgIndex(i);
      const direction = steps[i];
      const next = moveGrid(currentPos, direction);
      if (next) {
        currentPos = next;
        setIsAnimating(true);
        setGridPos(next);
        await new Promise<void>((resolve) => {
          animDoneResolveRef.current = resolve;
        });
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    setProgIndex(-1);
    setFinished(true);
  }, [steps]);

  // Auto-play on mount
  useEffect(() => {
    const timer = setTimeout(runProgram, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-screen w-screen">
      {/* Program steps bar — bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/60 backdrop-blur">
        <div
          ref={stepsRef}
          className="flex items-center gap-1 px-3 py-2 overflow-x-auto"
        >
          {steps.map((dir, i) => (
            <div
              key={i}
              className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg text-lg font-medium transition ${
                progIndex === i
                  ? "bg-yellow-300 scale-110"
                  : finished
                    ? "bg-white/20 text-white/60"
                    : "bg-white/10 text-white/40"
              }`}
            >
              {NFC_ICONS[dir]}
            </div>
          ))}
        </div>

        {/* Step count */}
        <div className="text-center text-xs text-white/40 pb-2">
          {steps.length} steps
        </div>
      </div>

      {/* Top bar — created date (left) + replay button (center) */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center">
        {/* Created date */}
        <div className="text-xs text-white/50">
          {createdAt ? (() => {
            const d = new Date(createdAt);
            const pad = (n: number) => String(n).padStart(2, "0");
            return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
          })() : ""}
        </div>

        {/* Replay button — centered */}
        <div className="flex-1 flex justify-center">
          {finished && (
            <button
              onClick={runProgram}
              className="rounded-xl bg-white/95 px-6 py-3 text-base font-bold text-black shadow-xl backdrop-blur border border-gray-200 transition hover:bg-white hover:scale-105"
            >
              Replay
            </button>
          )}
        </div>

        {/* 3D/2D toggle */}
        <button
          onClick={() => setIs2D((v) => !v)}
          className="rounded-lg bg-white/95 px-3 py-2 text-sm font-medium text-black shadow-md backdrop-blur border border-gray-200 transition hover:bg-white"
        >
          {is2D ? "3D" : "2D"}
        </button>
      </div>

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
