"use client";

import { useState, useCallback, useRef } from "react";
import {
  LevelConfig,
  LEVELS,
  GridPos,
  generateStartGoal,
  generateChallengeCount,
  gridCenter,
  checkMoveResult,
  checkProgramResult,
  isGoalPassthrough,
  buildLevelNtagParams,
} from "@/lib/levels";

export interface LevelState {
  // State
  active: boolean;
  levelId: string | null;
  config: LevelConfig | null;
  start: GridPos;
  goal: GridPos;
  cleared: boolean;
  challenge: number | null;
  moves: number;
  bursting: boolean;
  gridSize: number;

  // Actions
  activate: (levelId: string) => GridPos;
  deactivate: () => GridPos;
  generate: () => GridPos;
  newChallenge: () => GridPos;
  resetForRun: () => { startPos: GridPos };
  /** Check free-move result. Returns action to take. */
  onFreeMove: (pos: GridPos, isAnimating: boolean) => "success" | "burst" | null;
  /** Count a move (call when gridPos changes) */
  countMove: (pos: GridPos) => void;
  /** Check program run result */
  checkRunResult: (finalPos: GridPos, passedGoal: boolean) => "success" | "burst" | "none";
  /** Check if intermediate step passes goal */
  isPassthrough: (pos: GridPos, stepIndex: number, totalSteps: number) => boolean;
  /** Call after burst animation completes in free-move mode */
  onBurstReset: () => GridPos;
  setCleared: (v: boolean) => void;
  setBursting: (v: boolean) => void;
  /** Build NTAG params for this level */
  getNtagParams: () => Record<string, string>;
}

export function useLevel(): LevelState {
  const [levelId, setLevelId] = useState<string | null>(null);
  const [config, setConfig] = useState<LevelConfig | null>(null);
  const [start, setStart] = useState<GridPos>({ col: 0, row: 0 });
  const [goal, setGoal] = useState<GridPos>({ col: 2, row: 2 });
  const [cleared, setCleared] = useState(false);
  const [challenge, setChallenge] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [bursting, setBursting] = useState(false);

  const movesRef = useRef(0);
  const prevPosRef = useRef<GridPos>({ col: 0, row: 0 });

  const active = levelId !== null;
  const gridSize = config?.gridSize ?? 3;

  const activate = useCallback((id: string): GridPos => {
    const cfg = LEVELS[id];
    if (!cfg) return gridCenter(3);
    setLevelId(id);
    setConfig(cfg);
    const { start: s, goal: g } = generateStartGoal(cfg);
    setStart(s);
    setGoal(g);
    setCleared(false);
    setChallenge(null);
    setMoves(0);
    movesRef.current = 0;
    prevPosRef.current = s;
    return s;
  }, []);

  const deactivate = useCallback((): GridPos => {
    const gs = config?.gridSize ?? 3;
    setLevelId(null);
    setConfig(null);
    setCleared(false);
    setChallenge(null);
    setBursting(false);
    return gridCenter(gs);
  }, [config]);

  const generate = useCallback((): GridPos => {
    if (!config) return gridCenter(3);
    const { start: s, goal: g } = generateStartGoal(config);
    setStart(s);
    setGoal(g);
    setCleared(false);
    setChallenge(null);
    setMoves(0);
    movesRef.current = 0;
    prevPosRef.current = s;
    return s;
  }, [config]);

  const newChallenge = useCallback((): GridPos => {
    if (!config) return gridCenter(3);
    const count = generateChallengeCount(start, goal, challenge);
    setChallenge(count);
    setMoves(0);
    movesRef.current = 0;
    setCleared(false);
    prevPosRef.current = start;
    return start;
  }, [config, start, goal, challenge]);

  const resetForRun = useCallback(() => {
    setCleared(false);
    setMoves(0);
    movesRef.current = 0;
    prevPosRef.current = start;
    return { startPos: start };
  }, [start]);

  const countMove = useCallback((pos: GridPos) => {
    const prev = prevPosRef.current;
    if (prev.col !== pos.col || prev.row !== pos.row) {
      const next = movesRef.current + 1;
      movesRef.current = next;
      setMoves(next);
    }
    prevPosRef.current = pos;
  }, []);

  const onFreeMove = useCallback((pos: GridPos, isAnimating: boolean): "success" | "burst" | null => {
    if (!config || cleared || bursting || isAnimating) return null;
    return checkMoveResult(config, pos, goal, movesRef.current, challenge);
  }, [config, goal, cleared, bursting, challenge]);

  const checkRunResult = useCallback((finalPos: GridPos, passedGoal: boolean): "success" | "burst" | "none" => {
    if (!config) return "none";
    if (checkProgramResult(config, finalPos, goal, passedGoal)) return "success";
    return "burst";
  }, [config, goal]);

  const isPassthrough = useCallback((pos: GridPos, stepIndex: number, totalSteps: number): boolean => {
    if (!config) return false;
    return stepIndex < totalSteps - 1 && isGoalPassthrough(pos, goal);
  }, [config, goal]);

  const onBurstReset = useCallback((): GridPos => {
    setBursting(false);
    setMoves(0);
    movesRef.current = 0;
    prevPosRef.current = start;
    return start;
  }, [start]);

  const getNtagParams = useCallback((): Record<string, string> => {
    if (!config) return {};
    return buildLevelNtagParams(config, start, goal, challenge);
  }, [config, start, goal, challenge]);

  return {
    active,
    levelId,
    config,
    start,
    goal,
    cleared,
    challenge,
    moves,
    bursting,
    gridSize,
    activate,
    deactivate,
    generate,
    newChallenge,
    resetForRun,
    onFreeMove,
    countMove,
    checkRunResult,
    isPassthrough,
    onBurstReset,
    setCleared,
    setBursting,
    getNtagParams,
  };
}
