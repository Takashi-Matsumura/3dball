"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import {
  PatternConfig,
  NFC_ICONS,
  moveGrid,
  expandProgramWithMap,
} from "@/lib/ball-shared";
import { GridPos } from "@/lib/levels";
import { CameraController, Board, Ground, Sphere, CellMarker, TextSprite, ObstacleMarker } from "@/app/components/Scene";
import { playMove, playJump, playSuccess } from "@/lib/sounds";

interface LevelInfo {
  start: { col: number; row: number };
  goal: { col: number; row: number };
  challenge?: number;
}

interface ReplaySceneProps {
  steps: string[];
  color1?: string;
  color2?: string;
  scale?: number;
  pattern?: number;
  createdAt?: number;
  gridSize?: number;
  obstacles?: GridPos[];
  levelInfo?: LevelInfo;
}

export default function ReplayScene({ steps, color1, color2, scale, pattern, createdAt, gridSize: gridSizeProp, obstacles = [], levelInfo }: ReplaySceneProps) {
  const gridSize = gridSizeProp ?? 3;
  const startPos = levelInfo ? levelInfo.start : { col: 1, row: 1 };
  const [gridPos, setGridPos] = useState(startPos);
  const [levelCleared, setLevelCleared] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [is2D, setIs2D] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [progIndex, setProgIndex] = useState(-1);
  const [finished, setFinished] = useState(false);
  const animDoneResolveRef = useRef<(() => void) | null>(null);
  const jumpDoneResolveRef = useRef<(() => void) | null>(null);
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

  const handleJumpDone = useCallback(() => {
    setJumping(false);
    if (jumpDoneResolveRef.current) {
      jumpDoneResolveRef.current();
      jumpDoneResolveRef.current = null;
    }
  }, []);

  const runProgram = useCallback(async () => {
    setFinished(false);
    setLevelCleared(false);
    setGridPos(startPos);
    setIsAnimating(false);
    setProgIndex(-1);
    await new Promise((r) => setTimeout(r, 100));

    // Expand x2/x3 loops
    const { expanded, indexMap } = expandProgramWithMap(steps);

    let currentPos = { ...startPos };
    let passedGoal = false;
    for (let i = 0; i < expanded.length; i++) {
      setProgIndex(indexMap[i]);
      const direction = expanded[i];
      if (direction === "JUMP") {
        setJumping(true);
        playJump();
        await new Promise<void>((resolve) => {
          jumpDoneResolveRef.current = resolve;
        });
      } else {
        const next = moveGrid(currentPos, direction, gridSize, obstacles);
        if (next) {
          if (levelInfo && i < expanded.length - 1 &&
              next.col === levelInfo.goal.col && next.row === levelInfo.goal.row) {
            passedGoal = true;
          }
          currentPos = next;
          playMove();
          setIsAnimating(true);
          setGridPos(next);
          await new Promise<void>((resolve) => {
            animDoneResolveRef.current = resolve;
          });
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    setProgIndex(-1);
    setFinished(true);

    if (levelInfo && !passedGoal &&
        currentPos.col === levelInfo.goal.col && currentPos.row === levelInfo.goal.row) {
      setLevelCleared(true);
    }
    playSuccess();
  }, [steps, startPos, levelInfo, gridSize, obstacles]);

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
          className="flex items-center justify-center gap-1 px-3 py-2 overflow-x-auto"
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

        {/* Step count + level info */}
        <div className="text-center pb-2">
          {levelInfo ? (
            <div className="flex flex-col items-center gap-0.5">
              {levelInfo.challenge != null && (
                <span className="text-sm font-bold text-yellow-300">
                  {progIndex >= 0 ? progIndex + 1 : (finished ? steps.length : 0)} / {levelInfo.challenge}
                </span>
              )}
              <span className="text-xs text-yellow-300/70">
                {levelInfo.challenge != null
                  ? `${levelInfo.challenge} moves${obstacles.length > 0 ? ", avoid obstacles!" : " to the Goal!"}`
                  : (obstacles.length > 0 ? "Avoid obstacles!" : "Reach the Goal!")}
                {levelCleared && " ✓"}
              </span>
            </div>
          ) : (
            <span className="text-xs text-white/40">{steps.length} steps</span>
          )}
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
        <CameraController is2D={is2D} gridSize={gridSize} />
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
        <Board gridSize={gridSize} />
        {levelInfo && (
          <>
            <CellMarker col={levelInfo.start.col} row={levelInfo.start.row} color="#44cc44" gridSize={gridSize} />
            <TextSprite col={levelInfo.start.col} row={levelInfo.start.row} text="START" color="#44cc44" gridSize={gridSize} />
            <CellMarker col={levelInfo.goal.col} row={levelInfo.goal.row} color="#ffaa00" gridSize={gridSize} />
            <TextSprite col={levelInfo.goal.col} row={levelInfo.goal.row} text="GOAL" color="#ffaa00" gridSize={gridSize} />
            {obstacles.map((ob, i) => (
              <ObstacleMarker key={i} col={ob.col} row={ob.row} gridSize={gridSize} />
            ))}
          </>
        )}
        <Sphere
          gridCol={gridPos.col}
          gridRow={gridPos.row}
          jumping={jumping}
          onAnimDone={handleAnimDone}
          onJumpDone={handleJumpDone}
          patternConfig={patternConfig}
          gridSize={gridSize}
        />
      </Canvas>
    </div>
  );
}
