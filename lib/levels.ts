import { generateRandomPath, moveGrid, isHorizontalDir } from "@/lib/ball-shared";

export interface LevelConfig {
  id: string;
  gridSize: number;
  minDistance: number;
  hasChallenge: boolean;
  obstacleCount?: { min: number; max: number };
  branchCount?: { min: number; max: number };
  goalCount?: number;
  coinTotal?: { min: number; max: number };
  /** i18n key for theme text (e.g. "lv1Theme") */
  themeKey: string;
  /** i18n key for challenge theme text (e.g. "lv1ChallengeTheme") */
  challengeThemeKey: string;
  /** i18n key for level label (e.g. "lv1") */
  labelKey: string;
}

export interface BranchCell {
  col: number;
  row: number;
  horizontalBranch: "UP" | "DOWN";    // arriving horizontally → branch vertically
  verticalBranch: "LEFT" | "RIGHT";   // arriving vertically → branch horizontally
}

export interface GoalSpec {
  col: number;
  row: number;
  required: number;
}

export const LEVELS: Record<string, LevelConfig> = {
  lv1: { id: "lv1", gridSize: 3, minDistance: 2, hasChallenge: true, themeKey: "lv1Theme", challengeThemeKey: "lv1ChallengeTheme", labelKey: "lv1" },
  lv2: { id: "lv2", gridSize: 5, minDistance: 4, hasChallenge: true, obstacleCount: { min: 2, max: 4 }, themeKey: "lv2Theme", challengeThemeKey: "lv2ChallengeTheme", labelKey: "lv2" },
  lv3: { id: "lv3", gridSize: 5, minDistance: 4, hasChallenge: false, branchCount: { min: 1, max: 1 }, themeKey: "lv3Theme", challengeThemeKey: "lv3ChallengeTheme", labelKey: "lv3" },
  lv4: { id: "lv4", gridSize: 7, minDistance: 3, hasChallenge: false, goalCount: 2, coinTotal: { min: 3, max: 5 }, obstacleCount: { min: 3, max: 5 }, themeKey: "lv4Theme", challengeThemeKey: "lv4ChallengeTheme", labelKey: "lv4" },
};

export type GridPos = { col: number; row: number };

/** BFS check if path exists from start to goal avoiding obstacles */
export function hasPath(
  start: GridPos,
  goal: GridPos,
  gridSize: number,
  obstacles: GridPos[],
): boolean {
  const key = (c: number, r: number) => `${c},${r}`;
  const visited = new Set<string>();
  const queue: GridPos[] = [start];
  visited.add(key(start.col, start.row));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.col === goal.col && cur.row === goal.row) return true;
    for (const dir of ["UP", "DOWN", "LEFT", "RIGHT"]) {
      const next = moveGrid(cur, dir, gridSize, obstacles);
      if (!next) continue;
      const k = key(next.col, next.row);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push(next);
    }
  }
  return false;
}

/** Generate random obstacles for a level, ensuring path exists */
export function generateObstacles(
  config: LevelConfig,
  start: GridPos,
  goal: GridPos,
): GridPos[] {
  if (!config.obstacleCount) return [];
  const { min, max } = config.obstacleCount;
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const { gridSize } = config;

  for (let attempt = 0; attempt < 50; attempt++) {
    const obstacles: GridPos[] = [];
    const used = new Set<string>();
    used.add(`${start.col},${start.row}`);
    used.add(`${goal.col},${goal.row}`);

    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let t = 0; t < 20; t++) {
        const col = Math.floor(Math.random() * gridSize);
        const row = Math.floor(Math.random() * gridSize);
        const k = `${col},${row}`;
        if (!used.has(k)) {
          used.add(k);
          obstacles.push({ col, row });
          placed = true;
          break;
        }
      }
      if (!placed) break;
    }

    if (obstacles.length === count && hasPath(start, goal, gridSize, obstacles)) {
      return obstacles;
    }
  }
  return []; // fallback: no obstacles
}

/** Generate random branch cells for a level, ensuring branches don't overlap with start/goal/obstacles */
export function generateBranchCells(
  config: LevelConfig,
  start: GridPos,
  goal: GridPos,
  obstacles: GridPos[],
): BranchCell[] {
  if (!config.branchCount) return [];
  const { min, max } = config.branchCount;
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const { gridSize } = config;

  const used = new Set<string>();
  used.add(`${start.col},${start.row}`);
  used.add(`${goal.col},${goal.row}`);
  for (const o of obstacles) used.add(`${o.col},${o.row}`);

  // Restrict branch cells to the inner 3x3 region so outer-ring placements
  // can't create unavoidable deadlocks depending on arrival direction.
  const innerMin = Math.max(1, Math.floor((gridSize - 3) / 2));
  const innerMax = Math.min(gridSize - 2, innerMin + 2);
  const candidates: GridPos[] = [];
  for (let r = innerMin; r <= innerMax; r++) {
    for (let c = innerMin; c <= innerMax; c++) {
      if (!used.has(`${c},${r}`)) candidates.push({ col: c, row: r });
    }
  }

  const cells: BranchCell[] = [];
  for (let i = 0; i < count && candidates.length > 0; i++) {
    const idx = Math.floor(Math.random() * candidates.length);
    const pick = candidates.splice(idx, 1)[0];
    cells.push({
      col: pick.col,
      row: pick.row,
      horizontalBranch: Math.random() < 0.5 ? "UP" : "DOWN",
      verticalBranch: Math.random() < 0.5 ? "LEFT" : "RIGHT",
    });
  }
  return cells;
}

/** Generate start, goal, obstacles, and branch cells for a level */
export function generateLevel(config: LevelConfig): {
  start: GridPos;
  goal: GridPos;
  obstacles: GridPos[];
  branchCells: BranchCell[];
  goals?: GoalSpec[];
  coins?: GridPos[];
} {
  if (config.id === "lv4") {
    const layout = generateLv4Layout(config);
    return {
      start: layout.start,
      goal: layout.goals[0],
      obstacles: layout.obstacles,
      branchCells: [],
      goals: layout.goals,
      coins: layout.coins,
    };
  }
  const { start, goal } = generateStartGoal(config);
  const obstacles = generateObstacles(config, start, goal);
  const branchCells = generateBranchCells(config, start, goal, obstacles);
  return { start, goal, obstacles, branchCells };
}

/** Generate a Lv4 layout: start + multiple goals (with required counts) + coins + obstacles.
 *  Obstacle placement is BFS-validated so every coin and goal remains reachable from start. */
export function generateLv4Layout(config: LevelConfig): { start: GridPos; goals: GoalSpec[]; coins: GridPos[]; obstacles: GridPos[] } {
  const { gridSize, minDistance } = config;
  const goalCount = config.goalCount ?? 2;
  const coinRange = config.coinTotal ?? { min: 3, max: 5 };
  const obstacleRange = config.obstacleCount;

  const all: GridPos[] = [];
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++) all.push({ col: c, row: r });

  const dist = (a: GridPos, b: GridPos) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

  for (let attempt = 0; attempt < 100; attempt++) {
    const start = all[Math.floor(Math.random() * all.length)];
    const goalCandidates = all.filter((p) => dist(p, start) >= minDistance);
    if (goalCandidates.length < goalCount) continue;

    const goals: GridPos[] = [];
    const pool = [...goalCandidates];
    let ok = true;
    for (let g = 0; g < goalCount; g++) {
      const avail = pool.filter((p) => goals.every((gp) => dist(p, gp) >= 2));
      if (avail.length === 0) { ok = false; break; }
      const pick = avail[Math.floor(Math.random() * avail.length)];
      goals.push(pick);
      const idx = pool.findIndex((p) => p.col === pick.col && p.row === pick.row);
      if (idx >= 0) pool.splice(idx, 1);
    }
    if (!ok) continue;

    // Assign required counts per goal (each 1..3, sum in coinRange).
    const total = coinRange.min + Math.floor(Math.random() * (coinRange.max - coinRange.min + 1));
    const reqs = distributeRequired(total, goalCount);
    if (!reqs) continue;
    const goalSpecs: GoalSpec[] = goals.map((g, i) => ({ col: g.col, row: g.row, required: reqs[i] }));

    // Place coins equal to total, avoiding start and goals.
    const blocked = new Set<string>();
    blocked.add(`${start.col},${start.row}`);
    for (const g of goals) blocked.add(`${g.col},${g.row}`);
    const coinPool = all.filter((p) => !blocked.has(`${p.col},${p.row}`));
    if (coinPool.length < total) continue;
    const coins: GridPos[] = [];
    const coinUsed = new Set<string>();
    for (let i = 0; i < total; i++) {
      const remaining = coinPool.filter((p) => !coinUsed.has(`${p.col},${p.row}`));
      if (remaining.length === 0) break;
      const pick = remaining[Math.floor(Math.random() * remaining.length)];
      coins.push(pick);
      coinUsed.add(`${pick.col},${pick.row}`);
    }
    if (coins.length !== total) continue;

    // Place obstacles, ensuring all coins/goals remain reachable from start.
    const obstacles = obstacleRange
      ? placeLv4Obstacles(gridSize, start, goals, coins, obstacleRange)
      : [];

    return { start, goals: goalSpecs, coins, obstacles };
  }
  // Fallback: simple layout
  const start = { col: 0, row: 0 };
  const goals: GoalSpec[] = [
    { col: gridSize - 1, row: 0, required: 2 },
    { col: gridSize - 1, row: gridSize - 1, required: 2 },
  ];
  const coins: GridPos[] = [
    { col: 1, row: 1 }, { col: 2, row: 2 }, { col: 3, row: 3 }, { col: 4, row: 4 },
  ];
  return { start, goals, coins, obstacles: [] };
}

/** Place obstacles on the Lv4 grid while preserving reachability of every coin and goal from start. */
function placeLv4Obstacles(
  gridSize: number,
  start: GridPos,
  goals: GridPos[],
  coins: GridPos[],
  range: { min: number; max: number },
): GridPos[] {
  const count = range.min + Math.floor(Math.random() * (range.max - range.min + 1));
  const all: GridPos[] = [];
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++) all.push({ col: c, row: r });

  const reserved = new Set<string>();
  reserved.add(`${start.col},${start.row}`);
  for (const g of goals) reserved.add(`${g.col},${g.row}`);
  for (const c of coins) reserved.add(`${c.col},${c.row}`);

  const checkReachable = (obs: GridPos[]): boolean => {
    for (const g of goals) if (!hasPath(start, g, gridSize, obs)) return false;
    for (const c of coins) if (!hasPath(start, c, gridSize, obs)) return false;
    return true;
  };

  for (let attempt = 0; attempt < 40; attempt++) {
    const pool = all.filter((p) => !reserved.has(`${p.col},${p.row}`));
    const obstacles: GridPos[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const pick = pool.splice(idx, 1)[0];
      obstacles.push(pick);
    }
    if (obstacles.length === count && checkReachable(obstacles)) return obstacles;
  }
  return [];
}

/** Distribute `total` into `n` parts, each in [1, 3]. Returns null if infeasible. */
function distributeRequired(total: number, n: number): number[] | null {
  if (total < n || total > n * 3) return null;
  const parts = new Array(n).fill(1);
  let remaining = total - n;
  while (remaining > 0) {
    const idx = Math.floor(Math.random() * n);
    if (parts[idx] < 3) { parts[idx]++; remaining--; }
  }
  return parts;
}

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

/** Max move count a challenge can target. Caps the generator so kids don't
 *  get overwhelming targets and keeps the progress pip row manageable. */
export const MAX_CHALLENGE = 15;

/** Shortest path length from start to goal via BFS (returns Infinity if unreachable). */
function shortestPathLength(
  start: GridPos,
  goal: GridPos,
  gridSize: number,
  obstacles: GridPos[],
): number {
  const key = (c: number, r: number) => `${c},${r}`;
  const visited = new Set<string>();
  const queue: { pos: GridPos; dist: number }[] = [{ pos: start, dist: 0 }];
  visited.add(key(start.col, start.row));
  while (queue.length > 0) {
    const { pos, dist } = queue.shift()!;
    if (pos.col === goal.col && pos.row === goal.row) return dist;
    for (const dir of ["UP", "DOWN", "LEFT", "RIGHT"]) {
      const next = moveGrid(pos, dir, gridSize, obstacles);
      if (!next) continue;
      const k = key(next.col, next.row);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push({ pos: next, dist: dist + 1 });
    }
  }
  return Infinity;
}

/** Generate a challenge target move count in [minFeasible, MAX_CHALLENGE].
 *  Each call is independent and random — previously shown values can recur.
 *  The only constraint is that the result differs from `currentChallenge`
 *  when possible, so pressing Tab always produces a visible change. */
export function generateChallengeCount(
  start: GridPos,
  goal: GridPos,
  currentChallenge: number | null,
  gridSize: number = 3,
  obstacles: GridPos[] = [],
): number {
  const min = shortestPathLength(start, goal, gridSize, obstacles);
  const minFeasible = Math.max(1, Number.isFinite(min) ? min : 1);

  let count = minFeasible;
  let attempts = 0;
  const MAX_ATTEMPTS = 20;
  do {
    const path = generateRandomPath(start, goal, gridSize, obstacles);
    count = Math.min(Math.max(path.length, minFeasible), MAX_CHALLENGE);
    attempts++;
  } while (count === currentChallenge && attempts < MAX_ATTEMPTS);
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
  branchUsed: boolean = false,
): "success" | "burst" | null {
  const onGoal = pos.col === goal.col && pos.row === goal.row;
  if (onGoal) {
    if (challenge !== null && moves !== challenge) return "burst";
    if (config.branchCount && !branchUsed) return "burst";
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
  branchUsed: boolean = false,
  moves: number = 0,
  challenge: number | null = null,
): boolean {
  if (passedGoal) return false;
  if (finalPos.col !== goal.col || finalPos.row !== goal.row) return false;
  if (config.branchCount && !branchUsed) return false;
  if (challenge !== null && moves !== challenge) return false;
  return true;
}

/** Check if an intermediate step passes through goal */
export function isGoalPassthrough(
  pos: GridPos,
  goal: GridPos,
): boolean {
  return pos.col === goal.col && pos.row === goal.row;
}

/** Encode obstacles to a compact string: "1223" = col1row2, col2row3 */
export function encodeObstacles(obstacles: GridPos[]): string {
  return obstacles.map((o) => `${o.col}${o.row}`).join("");
}

/** Decode obstacles from compact string */
export function decodeObstacles(encoded: string): GridPos[] {
  const obstacles: GridPos[] = [];
  for (let i = 0; i + 1 < encoded.length; i += 2) {
    obstacles.push({ col: Number(encoded[i]), row: Number(encoded[i + 1]) });
  }
  return obstacles;
}

/** Encode branch cells: "12UD" = col1,row2,hBranch=UP,vBranch=DOWN (U/D for hBranch, L/R for vBranch) */
export function encodeBranchCells(cells: BranchCell[]): string {
  return cells.map((c) => {
    const h = c.horizontalBranch === "UP" ? "U" : "D";
    const v = c.verticalBranch === "LEFT" ? "L" : "R";
    return `${c.col}${c.row}${h}${v}`;
  }).join("");
}

/** Encode coins to compact string (same format as obstacles): "0102" = col0row1, col0row2 */
export function encodeCoins(coins: GridPos[]): string {
  return coins.map((c) => `${c.col}${c.row}`).join("");
}

/** Decode coins from compact string */
export function decodeCoins(encoded: string): GridPos[] {
  const coins: GridPos[] = [];
  for (let i = 0; i + 1 < encoded.length; i += 2) {
    coins.push({ col: Number(encoded[i]), row: Number(encoded[i + 1]) });
  }
  return coins;
}

/** Encode Lv4 goals: "042624" = goal(0,4) req 2, goal(6,2) req 4 (3 chars per goal: col,row,req) */
export function encodeGoals(goals: GoalSpec[]): string {
  return goals.map((g) => `${g.col}${g.row}${g.required}`).join("");
}

/** Decode Lv4 goals */
export function decodeGoals(encoded: string): GoalSpec[] {
  const goals: GoalSpec[] = [];
  for (let i = 0; i + 2 < encoded.length; i += 3) {
    goals.push({
      col: Number(encoded[i]),
      row: Number(encoded[i + 1]),
      required: Number(encoded[i + 2]),
    });
  }
  return goals;
}

/** Decode branch cells from compact string */
export function decodeBranchCells(encoded: string): BranchCell[] {
  const cells: BranchCell[] = [];
  for (let i = 0; i + 3 < encoded.length; i += 4) {
    cells.push({
      col: Number(encoded[i]),
      row: Number(encoded[i + 1]),
      horizontalBranch: encoded[i + 2] === "U" ? "UP" : "DOWN",
      verticalBranch: encoded[i + 3] === "L" ? "LEFT" : "RIGHT",
    });
  }
  return cells;
}

/** Resolve branch direction for a position given arrival direction and branch cells.
 *  Returns the resolved branch direction and the matching cell, or null if not on a branch cell. */
export function resolveBranchDir(
  pos: GridPos,
  arrivalDir: string,
  branchCells: BranchCell[],
): { branchDir: string; cell: BranchCell } | null {
  const cell = branchCells.find((c) => c.col === pos.col && c.row === pos.row);
  if (!cell) return null;
  const branchDir = isHorizontalDir(arrivalDir) ? cell.horizontalBranch : cell.verticalBranch;
  return { branchDir, cell };
}

/** Build NTAG URL params for a level */
export function buildLevelNtagParams(
  config: LevelConfig,
  start: GridPos,
  goal: GridPos,
  challenge: number | null,
  obstacles: GridPos[] = [],
  branchCells: BranchCell[] = [],
  goals: GoalSpec[] = [],
  coins: GridPos[] = [],
): Record<string, string> {
  const params: Record<string, string> = {
    lv: config.id,
    sc: String(start.col),
    sr: String(start.row),
    gc: String(goal.col),
    gr: String(goal.row),
  };
  if (challenge !== null) params.ch = String(challenge);
  if (obstacles.length > 0) params.ob = encodeObstacles(obstacles);
  if (branchCells.length > 0) params.br = encodeBranchCells(branchCells);
  if (goals.length > 0) params.gs = encodeGoals(goals);
  if (coins.length > 0) params.cn = encodeCoins(coins);
  return params;
}
