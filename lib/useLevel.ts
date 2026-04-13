"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  LevelConfig,
  LEVELS,
  GridPos,
  BranchCell,
  GoalSpec,
  generateLevel,
  generateChallengeCount,
  gridCenter,
  checkMoveResult,
  checkProgramResult,
  isGoalPassthrough,
  buildLevelNtagParams,
  resolveBranchDir,
} from "@/lib/levels";
import { playNfcScan, playBranch } from "@/lib/sounds";

export interface LevelState {
  // State
  active: boolean;
  levelId: string | null;
  config: LevelConfig | null;
  start: GridPos;
  goal: GridPos;
  obstacles: GridPos[];
  branchCells: BranchCell[];
  goals: GoalSpec[];
  coins: GridPos[];
  coinsCollected: boolean[];
  coinsHeld: number;
  goalsRemaining: number[];
  lastMoveDirection: string | null;
  cleared: boolean;
  challenge: number | null;
  moves: number;
  bursting: boolean;
  branchUsed: boolean;
  gridSize: number;

  // Actions
  activate: (levelId: string) => GridPos;
  deactivate: () => GridPos;
  generate: () => GridPos;
  newChallenge: () => GridPos;
  /** Clear the current challenge (return to "no target move count") */
  clearChallenge: () => GridPos;
  resetForRun: () => { startPos: GridPos };
  /** Check free-move result. Returns action to take. */
  onFreeMove: (pos: GridPos, isAnimating: boolean) => "success" | "burst" | null;
  /** Count a move (call when gridPos changes) */
  countMove: (pos: GridPos) => void;
  /** Handle arrival at a cell: collect coin / deliver to goal (Lv4).
   *  Returns true if this arrival cleared the level. */
  onCellArrival: (pos: GridPos) => boolean;
  /** Manually increment move counter (e.g. for JUMP which doesn't change position) */
  addMove: () => void;
  /** Check program run result. `extraActions` is added to tracked moves (e.g. JUMPs not counted via position). */
  checkRunResult: (finalPos: GridPos, passedGoal: boolean, runBranchUsed?: boolean, extraActions?: number) => "success" | "burst" | "none";
  /** Check if intermediate step passes goal */
  isPassthrough: (pos: GridPos, stepIndex: number, totalSteps: number) => boolean;
  /** Call after burst animation completes in free-move mode */
  onBurstReset: () => GridPos;
  setCleared: (v: boolean) => void;
  setBursting: (v: boolean) => void;
  setBranchUsed: (v: boolean) => void;
  /** Build NTAG params for this level */
  getNtagParams: () => Record<string, string>;
  /** Check if pos is on a branch cell and return branch direction based on arrival direction */
  checkBranch: (pos: GridPos) => { isBranch: boolean; branchDir: string | null };
}

export function useLevel(): LevelState {
  const [levelId, setLevelId] = useState<string | null>(null);
  const [config, setConfig] = useState<LevelConfig | null>(null);
  const [start, setStart] = useState<GridPos>({ col: 0, row: 0 });
  const [goal, setGoal] = useState<GridPos>({ col: 2, row: 2 });
  const [obstacles, setObstacles] = useState<GridPos[]>([]);
  const [branchCells, setBranchCells] = useState<BranchCell[]>([]);
  const [goals, setGoals] = useState<GoalSpec[]>([]);
  const [coins, setCoins] = useState<GridPos[]>([]);
  const [coinsCollected, setCoinsCollected] = useState<boolean[]>([]);
  const [coinsHeld, setCoinsHeld] = useState(0);
  const [goalsRemaining, setGoalsRemaining] = useState<number[]>([]);
  const goalsRef = useRef<GoalSpec[]>([]);
  const coinsRef = useRef<GridPos[]>([]);
  const coinsCollectedRef = useRef<boolean[]>([]);
  const coinsHeldRef = useRef(0);
  const goalsRemainingRef = useRef<number[]>([]);
  const lastMoveDirRef = useRef<string | null>(null);
  const [cleared, setCleared] = useState(false);
  const [challenge, setChallenge] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [bursting, setBursting] = useState(false);
  const [branchUsed, setBranchUsed] = useState(false);

  const movesRef = useRef(0);
  const prevPosRef = useRef<GridPos>({ col: 0, row: 0 });
  const clearedRef = useRef(false);
  useEffect(() => { clearedRef.current = cleared; }, [cleared]);

  const active = levelId !== null;
  const gridSize = config?.gridSize ?? 3;

  const applyLv4State = useCallback((gs: GoalSpec[], cs: GridPos[]) => {
    const reqs = gs.map((g) => g.required);
    const collected = cs.map(() => false);
    setGoals(gs);
    setCoins(cs);
    setGoalsRemaining(reqs);
    setCoinsCollected(collected);
    setCoinsHeld(0);
    goalsRef.current = gs;
    coinsRef.current = cs;
    goalsRemainingRef.current = reqs;
    coinsCollectedRef.current = collected;
    coinsHeldRef.current = 0;
  }, []);

  const resetLv4Progress = useCallback(() => {
    const reqs = goalsRef.current.map((g) => g.required);
    const collected = coinsRef.current.map(() => false);
    setGoalsRemaining(reqs);
    setCoinsCollected(collected);
    setCoinsHeld(0);
    goalsRemainingRef.current = reqs;
    coinsCollectedRef.current = collected;
    coinsHeldRef.current = 0;
  }, []);

  const activate = useCallback((id: string): GridPos => {
    const cfg = LEVELS[id];
    if (!cfg) return gridCenter(3);
    setLevelId(id);
    setConfig(cfg);
    const { start: s, goal: g, obstacles: obs, branchCells: br, goals: gs, coins: cs } = generateLevel(cfg);
    setStart(s);
    setGoal(g);
    setObstacles(obs);
    setBranchCells(br);
    if (cfg.id === "lv4" && gs && cs) applyLv4State(gs, cs);
    else applyLv4State([], []);
    lastMoveDirRef.current = null;
    setCleared(false);
    setChallenge(null);
    setMoves(0);
    setBranchUsed(false);
    movesRef.current = 0;
    prevPosRef.current = s;
    return s;
  }, [applyLv4State]);

  const deactivate = useCallback((): GridPos => {
    setLevelId(null);
    setConfig(null);
    setObstacles([]);
    setBranchCells([]);
    applyLv4State([], []);
    lastMoveDirRef.current = null;
    setCleared(false);
    setChallenge(null);
    setBursting(false);
    setBranchUsed(false);
    return gridCenter(3);
  }, [applyLv4State]);

  const generate = useCallback((): GridPos => {
    if (!config) return gridCenter(3);
    const { start: s, goal: g, obstacles: obs, branchCells: br, goals: gs, coins: cs } = generateLevel(config);
    setStart(s);
    setGoal(g);
    setObstacles(obs);
    setBranchCells(br);
    if (config.id === "lv4" && gs && cs) applyLv4State(gs, cs);
    else applyLv4State([], []);
    lastMoveDirRef.current = null;
    setCleared(false);
    setChallenge(null);
    setMoves(0);
    setBranchUsed(false);
    movesRef.current = 0;
    prevPosRef.current = s;
    return s;
  }, [config, applyLv4State]);

  const newChallenge = useCallback((): GridPos => {
    if (!config) return gridCenter(3);
    const count = generateChallengeCount(start, goal, challenge, config.gridSize, obstacles);
    setChallenge(count);
    setMoves(0);
    setBranchUsed(false);
    movesRef.current = 0;
    setCleared(false);
    lastMoveDirRef.current = null;
    prevPosRef.current = start;
    return start;
  }, [config, start, goal, challenge, obstacles]);

  const clearChallenge = useCallback((): GridPos => {
    setChallenge(null);
    setMoves(0);
    setBranchUsed(false);
    movesRef.current = 0;
    setCleared(false);
    lastMoveDirRef.current = null;
    prevPosRef.current = start;
    return start;
  }, [start]);

  const resetForRun = useCallback(() => {
    setCleared(false);
    clearedRef.current = false;
    setMoves(0);
    setBranchUsed(false);
    movesRef.current = 0;
    prevPosRef.current = start;
    resetLv4Progress();
    return { startPos: start };
  }, [start, resetLv4Progress]);

  const countMove = useCallback((pos: GridPos) => {
    const prev = prevPosRef.current;
    if (prev.col !== pos.col || prev.row !== pos.row) {
      // Track direction from position delta (always, even after clearing)
      const dc = pos.col - prev.col;
      const dr = pos.row - prev.row;
      if (dc > 0) lastMoveDirRef.current = "RIGHT";
      else if (dc < 0) lastMoveDirRef.current = "LEFT";
      else if (dr > 0) lastMoveDirRef.current = "DOWN";
      else if (dr < 0) lastMoveDirRef.current = "UP";
      // Only count moves before clearing
      if (!cleared) {
        const next = movesRef.current + 1;
        movesRef.current = next;
        setMoves(next);
      }
    }
    prevPosRef.current = pos;
  }, [cleared]);

  const addMove = useCallback(() => {
    if (clearedRef.current) return;
    const next = movesRef.current + 1;
    movesRef.current = next;
    setMoves(next);
  }, []);

  const onCellArrival = useCallback((pos: GridPos): boolean => {
    if (!config || config.id !== "lv4") return false;
    if (clearedRef.current) return false;
    // Coin pickup
    const coinIdx = coinsRef.current.findIndex(
      (c, i) => c.col === pos.col && c.row === pos.row && !coinsCollectedRef.current[i],
    );
    if (coinIdx >= 0) {
      const nextCollected = [...coinsCollectedRef.current];
      nextCollected[coinIdx] = true;
      coinsCollectedRef.current = nextCollected;
      setCoinsCollected(nextCollected);
      const nextHeld = coinsHeldRef.current + 1;
      coinsHeldRef.current = nextHeld;
      setCoinsHeld(nextHeld);
      playNfcScan();
    }
    // Goal delivery
    const goalIdx = goalsRef.current.findIndex((g) => g.col === pos.col && g.row === pos.row);
    if (goalIdx >= 0) {
      const remaining = goalsRemainingRef.current[goalIdx];
      if (remaining > 0 && coinsHeldRef.current > 0) {
        const delivered = Math.min(coinsHeldRef.current, remaining);
        const nextRemaining = [...goalsRemainingRef.current];
        nextRemaining[goalIdx] = remaining - delivered;
        goalsRemainingRef.current = nextRemaining;
        setGoalsRemaining(nextRemaining);
        const nextHeld = coinsHeldRef.current - delivered;
        coinsHeldRef.current = nextHeld;
        setCoinsHeld(nextHeld);
        playBranch();
        // Clear when all goals fulfilled
        if (nextRemaining.every((r) => r === 0)) {
          clearedRef.current = true;
          setCleared(true);
          return true;
        }
      }
    }
    return false;
  }, [config]);

  const onFreeMove = useCallback((pos: GridPos, isAnimating: boolean): "success" | "burst" | null => {
    if (!config || cleared || bursting || isAnimating) return null;
    // Lv4 clear is decided by onCellArrival (all goals filled), not by touching a single goal cell.
    if (config.id === "lv4") return null;
    return checkMoveResult(config, pos, goal, movesRef.current, challenge, branchUsed);
  }, [config, goal, cleared, bursting, challenge, branchUsed]);

  const checkRunResult = useCallback((finalPos: GridPos, passedGoal: boolean, runBranchUsed: boolean = false, extraActions: number = 0): "success" | "burst" | "none" => {
    if (!config) return "none";
    if (config.id === "lv4") {
      return goalsRemainingRef.current.every((r) => r === 0) ? "success" : "burst";
    }
    const totalMoves = movesRef.current + extraActions;
    if (checkProgramResult(config, finalPos, goal, passedGoal, runBranchUsed, totalMoves, challenge)) return "success";
    return "burst";
  }, [config, goal, challenge]);

  const isPassthrough = useCallback((pos: GridPos, stepIndex: number, totalSteps: number): boolean => {
    if (!config) return false;
    return stepIndex < totalSteps - 1 && isGoalPassthrough(pos, goal);
  }, [config, goal]);

  const onBurstReset = useCallback((): GridPos => {
    setBursting(false);
    setMoves(0);
    setBranchUsed(false);
    movesRef.current = 0;
    lastMoveDirRef.current = null;
    prevPosRef.current = start;
    resetLv4Progress();
    return start;
  }, [start, resetLv4Progress]);

  const checkBranch = useCallback((pos: GridPos): { isBranch: boolean; branchDir: string | null } => {
    const dir = lastMoveDirRef.current;
    if (!dir) return { isBranch: false, branchDir: null };
    const result = resolveBranchDir(pos, dir, branchCells);
    if (!result) return { isBranch: false, branchDir: null };
    return { isBranch: true, branchDir: result.branchDir };
  }, [branchCells]);

  const getNtagParams = useCallback((): Record<string, string> => {
    if (!config) return {};
    return buildLevelNtagParams(config, start, goal, challenge, obstacles, branchCells, goals, coins);
  }, [config, start, goal, challenge, obstacles, branchCells, goals, coins]);

  return {
    active,
    levelId,
    config,
    start,
    goal,
    obstacles,
    branchCells,
    goals,
    coins,
    coinsCollected,
    coinsHeld,
    goalsRemaining,
    lastMoveDirection: lastMoveDirRef.current,
    cleared,
    challenge,
    moves,
    bursting,
    branchUsed,
    gridSize,
    activate,
    deactivate,
    generate,
    newChallenge,
    clearChallenge,
    resetForRun,
    onFreeMove,
    countMove,
    onCellArrival,
    addMove,
    checkRunResult,
    isPassthrough,
    onBurstReset,
    setCleared,
    setBursting,
    setBranchUsed,
    getNtagParams,
    checkBranch,
  };
}
