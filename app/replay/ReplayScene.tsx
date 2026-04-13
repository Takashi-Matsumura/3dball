"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import {
  PatternConfig,
  NFC_ICONS,
} from "@/lib/ball-shared";
import { GridPos, BranchCell, GoalSpec } from "@/lib/levels";
import { SceneLighting, CameraController, Board, Ground, Sphere, CellMarker, TextSprite, ObstacleMarker, BranchMarker, CoinMarker, GoalRequirementSprite } from "@/app/components/Scene";
import { playSuccess, playBurst, playNfcScan, playBranch } from "@/lib/sounds";
import { useProgramRunner } from "@/lib/useProgramRunner";

interface LevelInfo {
  levelId?: string;
  start: { col: number; row: number };
  goal: { col: number; row: number };
  challenge?: number;
}

interface Lv4Data {
  goals: GoalSpec[];
  coins: GridPos[];
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
  branchCells?: BranchCell[];
  levelInfo?: LevelInfo;
  lv4Data?: Lv4Data;
}

export default function ReplayScene({ steps, color1, color2, scale, pattern, createdAt, gridSize: gridSizeProp, obstacles = [], branchCells = [], levelInfo, lv4Data }: ReplaySceneProps) {
  const gridSize = gridSizeProp ?? 3;
  const startPos = levelInfo ? levelInfo.start : { col: 1, row: 1 };
  const runner = useProgramRunner();
  const { gridPos, jumping, celebrating, progIndex, handleAnimDone, handleJumpDone, handleCelebrateDone, triggerCelebrate } = runner;
  const [levelCleared, setLevelCleared] = useState(false);
  const [is2D, setIs2D] = useState(false);
  const [finished, setFinished] = useState(false);
  const [bursting, setBursting] = useState(false);
  const burstDoneResolveRef = useRef<(() => void) | null>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  // Lv4 replay state
  const isLv4 = !!lv4Data;
  const [coinsCollected, setCoinsCollected] = useState<boolean[]>(lv4Data?.coins.map(() => false) ?? []);
  const [coinsHeld, setCoinsHeld] = useState(0);
  const [goalsRemaining, setGoalsRemaining] = useState<number[]>(lv4Data?.goals.map((g) => g.required) ?? []);
  const coinsCollectedRef = useRef<boolean[]>(coinsCollected);
  const coinsHeldRef = useRef(0);
  const goalsRemainingRef = useRef<number[]>(goalsRemaining);
  useEffect(() => { coinsCollectedRef.current = coinsCollected; }, [coinsCollected]);
  useEffect(() => { coinsHeldRef.current = coinsHeld; }, [coinsHeld]);
  useEffect(() => { goalsRemainingRef.current = goalsRemaining; }, [goalsRemaining]);

  const resetLv4 = useCallback(() => {
    if (!lv4Data) return;
    const initCollected = lv4Data.coins.map(() => false);
    const initReqs = lv4Data.goals.map((g) => g.required);
    setCoinsCollected(initCollected);
    setGoalsRemaining(initReqs);
    setCoinsHeld(0);
    coinsCollectedRef.current = initCollected;
    goalsRemainingRef.current = initReqs;
    coinsHeldRef.current = 0;
  }, [lv4Data]);

  // Lv4 arrival handler: update state on each gridPos change
  useEffect(() => {
    if (!lv4Data) return;
    // Coin pickup
    const coinIdx = lv4Data.coins.findIndex(
      (c, i) => c.col === gridPos.col && c.row === gridPos.row && !coinsCollectedRef.current[i],
    );
    if (coinIdx >= 0) {
      const next = [...coinsCollectedRef.current];
      next[coinIdx] = true;
      setCoinsCollected(next);
      setCoinsHeld((h) => h + 1);
      playNfcScan();
    }
    // Goal delivery
    const goalIdx = lv4Data.goals.findIndex((g) => g.col === gridPos.col && g.row === gridPos.row);
    if (goalIdx >= 0) {
      const remaining = goalsRemainingRef.current[goalIdx];
      const held = coinsHeldRef.current;
      if (remaining > 0 && held > 0) {
        const delivered = Math.min(held, remaining);
        const nextRemaining = [...goalsRemainingRef.current];
        nextRemaining[goalIdx] = remaining - delivered;
        setGoalsRemaining(nextRemaining);
        setCoinsHeld(held - delivered);
        playBranch();
      }
    }
  }, [gridPos, lv4Data]);

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

  const runProgram = useCallback(async (reverseBranch: boolean = false) => {
    setFinished(false);
    setLevelCleared(false);
    setBursting(false);
    resetLv4();

    // For Lv4, any goal is visited intentionally — disable passthrough burst.
    const isPassthrough = levelInfo && !isLv4
      ? (pos: { col: number; row: number }, i: number, total: number) =>
          i < total - 1 && pos.col === levelInfo.goal.col && pos.row === levelInfo.goal.row
      : undefined;

    const { finalPos, passedGoal } = await runner.runSteps({
      steps,
      startPos,
      gridSize,
      obstacles,
      branchCells,
      isPassthrough,
      reverseBranch,
    });

    setFinished(true);
    const reachedGoal = !!levelInfo && !isLv4 && !passedGoal &&
      finalPos.col === levelInfo.goal.col && finalPos.row === levelInfo.goal.row;
    const lv4Cleared = isLv4 && goalsRemainingRef.current.every((r) => r === 0);

    if (!levelInfo) {
      playSuccess();
    } else if (reachedGoal || lv4Cleared) {
      setLevelCleared(true);
      playSuccess();
      await triggerCelebrate();
    } else {
      setBursting(true);
      playBurst();
      await new Promise<void>((resolve) => { burstDoneResolveRef.current = resolve; });
    }
  }, [steps, startPos, levelInfo, isLv4, gridSize, obstacles, branchCells, runner, triggerCelebrate, resetLv4]);

  const handleBurstDone = useCallback(() => {
    setBursting(false);
    if (burstDoneResolveRef.current) {
      burstDoneResolveRef.current();
      burstDoneResolveRef.current = null;
    }
  }, []);

  // Auto-play on mount
  useEffect(() => {
    const timer = setTimeout(() => runProgram(false), 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasBranch = steps.includes("BRANCH");

  return (
    <div className="relative h-screen w-screen">
      {/* Lv4 status bar — floating above step bar (hidden mode — fuchsia theme) */}
      {isLv4 && lv4Data && (
        <div className="absolute bottom-24 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-b from-fuchsia-500/95 to-purple-600/95 px-5 py-2.5 shadow-xl ring-2 ring-fuchsia-300/60 backdrop-blur">
            <div className="flex items-baseline gap-2 text-white">
              <span className="text-xs font-bold tracking-wide text-white/80">Carrying</span>
              <span className="text-2xl font-black leading-none">{coinsHeld}</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {lv4Data.goals.map((_, i) => {
                const remain = goalsRemaining[i] ?? 0;
                const done = remain === 0;
                return (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${
                      done ? "bg-emerald-300/90 text-emerald-950 ring-emerald-200/80" : "bg-white/20 text-white ring-white/30"
                    }`}
                  >
                    Goal {String.fromCharCode(65 + i)}: {done ? "✓" : `need ${remain}`}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Program steps bar — bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/60 backdrop-blur">
        <div
          ref={stepsRef}
          className="flex items-center justify-center gap-1 px-3 py-2 overflow-x-auto"
        >
          {steps.map((dir, i) => {
            // Skip structural P-block tokens
            if (dir === "PIPE" || dir === "SLASH") return null;
            const icon = NFC_ICONS[dir];
            if (!icon) return null;
            return (
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
                {icon}
              </div>
            );
          })}
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
        <div className="flex-1 flex justify-center gap-2">
          {finished && (
            <>
              <button
                onClick={() => runProgram(false)}
                className="rounded-xl bg-white/95 px-6 py-3 text-base font-bold text-black shadow-xl backdrop-blur border border-gray-200 transition hover:bg-white hover:scale-105"
              >
                Replay
              </button>
              {hasBranch && (
                <button
                  onClick={() => runProgram(true)}
                  title="Reverse branch"
                  className="rounded-xl bg-purple-500/95 px-6 py-3 text-base font-bold text-white shadow-xl backdrop-blur border border-purple-400 transition hover:bg-purple-500 hover:scale-105 flex items-center gap-2"
                >
                  <span>?</span>
                  <span>⇄</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* 3D/2D toggle */}
        <button
          onClick={() => setIs2D((v) => !v)}
          className="rounded-xl bg-white/95 px-6 py-3 text-base font-bold text-black shadow-xl backdrop-blur border border-gray-200 transition hover:bg-white hover:scale-105"
        >
          {is2D ? "3D" : "2D"}
        </button>
      </div>

      <Canvas camera={{ position: [0, 5, 5], fov: 45 }} gl={{ antialias: true }} shadows>
        <SceneLighting gridSize={gridSize} />
        <CameraController is2D={is2D} gridSize={gridSize} />
        <Ground />
        <Board gridSize={gridSize} />
        {levelInfo && (
          <>
            <CellMarker col={levelInfo.start.col} row={levelInfo.start.row} color="#44cc44" gridSize={gridSize} />
            <TextSprite col={levelInfo.start.col} row={levelInfo.start.row} text="START" color="#44cc44" gridSize={gridSize} />
            {!isLv4 && (
              <>
                <CellMarker col={levelInfo.goal.col} row={levelInfo.goal.row} color="#ffaa00" gridSize={gridSize} />
                <TextSprite col={levelInfo.goal.col} row={levelInfo.goal.row} text="GOAL" color="#ffaa00" gridSize={gridSize} />
              </>
            )}
            {isLv4 && lv4Data && lv4Data.goals.map((g, i) => {
              const remain = goalsRemaining[i] ?? 0;
              const done = remain === 0;
              const color = done ? "#44cc44" : "#ffaa00";
              const label = `Goal ${String.fromCharCode(65 + i)}`;
              return (
                <group key={`gl-${i}`}>
                  <CellMarker col={g.col} row={g.row} color={color} gridSize={gridSize} />
                  <GoalRequirementSprite col={g.col} row={g.row} label={label} remaining={remain} done={done} gridSize={gridSize} />
                </group>
              );
            })}
            {obstacles.map((ob, i) => (
              <ObstacleMarker key={`ob-${i}`} col={ob.col} row={ob.row} gridSize={gridSize} />
            ))}
            {branchCells.map((bc, i) => (
              <BranchMarker key={`br-${i}`} branchCell={bc} gridSize={gridSize} />
            ))}
            {isLv4 && lv4Data && lv4Data.coins.map((c, i) => (
              <CoinMarker key={`cn-${i}`} col={c.col} row={c.row} collected={coinsCollected[i] ?? false} gridSize={gridSize} />
            ))}
          </>
        )}
        <Sphere
          gridCol={gridPos.col}
          gridRow={gridPos.row}
          jumping={jumping}
          bursting={bursting}
          celebrating={celebrating}
          onAnimDone={handleAnimDone}
          onJumpDone={handleJumpDone}
          onBurstDone={handleBurstDone}
          onCelebrateDone={handleCelebrateDone}
          patternConfig={patternConfig}
          gridSize={gridSize}
        />
      </Canvas>
    </div>
  );
}
