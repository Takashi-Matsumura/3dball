import { generateRandomPath, moveGrid } from "@/lib/ball-shared";

export interface LevelConfig {
  id: string;
  gridSize: number;
  minDistance: number;
  hasChallenge: boolean;
}

export const LEVELS: Record<string, LevelConfig> = {
  lv1: { id: "lv1", gridSize: 3, minDistance: 2, hasChallenge: true },
};

export type GridPos = { col: number; row: number };

/** Generate random start/goal positions for a level */
export function generateStartGoal(config: LevelConfig): { start: GridPos; goal: GridPos } {
  const { gridSize, minDistance } = config;
  const positions: GridPos[] = [];
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++)
      positions.push({ col: c, row: r });

  const startIdx = Math.floor(Math.random() * positions.length);
  const start = positions[startIdx];
  const far = positions.filter(
    (p) => Math.abs(p.col - start.col) + Math.abs(p.row - start.row) >= minDistance,
  );
  const goal = far[Math.floor(Math.random() * far.length)];
  return { start, goal };
}

/** Generate a challenge target move count */
export function generateChallengeCount(
  start: GridPos,
  goal: GridPos,
  currentChallenge: number | null,
): number {
  let count: number;
  let attempts = 0;
  do {
    const path = generateRandomPath(start, goal);
    count = path.length;
    attempts++;
  } while (count === currentChallenge && attempts < 20);
  return count;
}

/** Center position of a grid (used as default ball position when no level active) */
export function gridCenter(gridSize: number): GridPos {
  const center = Math.floor(gridSize / 2);
  return { col: center, row: center };
}

/** Check if a move result triggers success or failure in the level */
export function checkMoveResult(
  config: LevelConfig,
  pos: GridPos,
  goal: GridPos,
  moves: number,
  challenge: number | null,
): "success" | "burst" | null {
  const onGoal = pos.col === goal.col && pos.row === goal.row;
  if (onGoal) {
    if (challenge !== null && moves !== challenge) return "burst";
    return "success";
  }
  if (challenge !== null && moves > challenge) return "burst";
  return null;
}

/** Check if a program run result is success in the level */
export function checkProgramResult(
  config: LevelConfig,
  finalPos: GridPos,
  goal: GridPos,
  passedGoal: boolean,
): boolean {
  return !passedGoal && finalPos.col === goal.col && finalPos.row === goal.row;
}

/** Check if an intermediate step passes through goal */
export function isGoalPassthrough(
  pos: GridPos,
  goal: GridPos,
): boolean {
  return pos.col === goal.col && pos.row === goal.row;
}

/** Build NTAG URL params for a level */
export function buildLevelNtagParams(
  config: LevelConfig,
  start: GridPos,
  goal: GridPos,
  challenge: number | null,
): Record<string, string> {
  const params: Record<string, string> = {
    sc: String(start.col),
    sr: String(start.row),
    gc: String(goal.col),
    gr: String(goal.row),
  };
  if (challenge !== null) params.ch = String(challenge);
  return params;
}
