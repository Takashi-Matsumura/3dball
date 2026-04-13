// Program intermediate representation: tokenization, encoding, loop expansion,
// P-block (if-else BRANCH) parsing, and display grouping.
// Grid/movement primitives stay in ball-shared.ts.

import { isHorizontalDir } from "./ball-shared";

// ── Structural tokens ────────────────────────────────────────────────

/** Find the index of the matching SLASH for a BRANCH token at branchIndex.
 *  Handles nested BRANCH/SLASH pairs via depth tracking.
 *  Returns tokens.length if no matching SLASH is found. */
export function findMatchingSlash(tokens: string[], branchIndex: number): number {
  let depth = 0;
  let j = branchIndex + 1;
  while (j < tokens.length) {
    if (tokens[j] === "BRANCH") depth++;
    if (tokens[j] === "SLASH") {
      if (depth === 0) return j;
      depth--;
    }
    j++;
  }
  return tokens.length;
}

/** Split a P-block (BRANCH...PIPE...SLASH) into if/else bodies.
 *  Returns the two body arrays and the index of the closing SLASH. */
export function splitPBlock(tokens: string[], branchIndex: number): { ifBody: string[]; elseBody: string[]; endIndex: number } {
  const endIndex = findMatchingSlash(tokens, branchIndex);
  const blockContent = tokens.slice(branchIndex + 1, endIndex);
  const pipePos = blockContent.indexOf("PIPE");
  const ifBody = pipePos >= 0 ? blockContent.slice(0, pipePos) : blockContent;
  const elseBody = pipePos >= 0 ? blockContent.slice(pipePos + 1) : [];
  return { ifBody, elseBody, endIndex };
}

// ── Encoding / decoding ──────────────────────────────────────────────

const DIRECTION_CHARS: Record<string, string> = { UP: "U", DOWN: "D", LEFT: "L", RIGHT: "R", JUMP: "J", X2: "2", X3: "3", BRANCH: "B", PIPE: "E", SLASH: "F" };
const CHAR_DIRECTIONS: Record<string, string> = { U: "UP", D: "DOWN", L: "LEFT", R: "RIGHT", J: "JUMP", "2": "X2", "3": "X3", B: "BRANCH", E: "PIPE", F: "SLASH" };

export function encodeProgram(steps: string[]): string {
  return steps.map((s) => DIRECTION_CHARS[s] || "").join("");
}

export function decodeProgram(encoded: string): string[] {
  return encoded.split("").map((c) => CHAR_DIRECTIONS[c]).filter(Boolean);
}

// ── Loop expansion ───────────────────────────────────────────────────

/** Expand x2/x3 loop cards in a program.
 *  x2 = repeat previous command 2 times total, x3 = 3 times total.
 *  Consecutive loops add: → x2 x2 = 4, → x2 x3 = 5 */
export function expandProgram(steps: string[]): string[] {
  return expandProgramWithMap(steps).expanded;
}

export function expandProgramWithMap(steps: string[]): { expanded: string[]; indexMap: number[] } {
  const expanded: string[] = [];
  const indexMap: number[] = [];

  let baseCommand: string | null = null;
  let baseIndex = -1;
  let totalRepeat = 0;

  const flush = () => {
    if (baseCommand && totalRepeat > 0) {
      // Remove the 1 already pushed for the base command
      expanded.pop();
      indexMap.pop();
      for (let r = 0; r < totalRepeat; r++) {
        expanded.push(baseCommand!);
        indexMap.push(baseIndex);
      }
    }
    baseCommand = null;
    totalRepeat = 0;
  };

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s === "X2" || s === "X3") {
      const n = s === "X2" ? 2 : 3;
      if (baseCommand === null) {
        continue;
      }
      if (totalRepeat === 0) {
        totalRepeat = n;
      } else {
        totalRepeat += n;
      }
      baseIndex = i;
    } else if (s === "BRANCH") {
      // P-block: flush any pending repeat, then copy the entire P-block as-is
      // (with internal X2/X3 expanded within each body)
      flush();
      expanded.push("BRANCH");
      indexMap.push(i);
      const { ifBody: ifRaw, elseBody: elseRaw, endIndex: j } = splitPBlock(steps, i);
      const ifExpanded = expandProgramWithMap(ifRaw);
      const elseExpanded = expandProgramWithMap(elseRaw);
      const ifBaseIdx = i + 1;
      for (let k = 0; k < ifExpanded.expanded.length; k++) {
        expanded.push(ifExpanded.expanded[k]);
        indexMap.push(ifBaseIdx + ifExpanded.indexMap[k]);
      }
      const pipeSourceIdx = i + 1 + ifRaw.length;
      expanded.push("PIPE");
      indexMap.push(pipeSourceIdx);
      const elseBaseIdx = pipeSourceIdx + 1;
      for (let k = 0; k < elseExpanded.expanded.length; k++) {
        expanded.push(elseExpanded.expanded[k]);
        indexMap.push(elseBaseIdx + elseExpanded.indexMap[k]);
      }
      expanded.push("SLASH");
      indexMap.push(j);
      i = j;
    } else if (s === "PIPE" || s === "SLASH") {
      flush();
    } else {
      flush();
      baseCommand = s;
      baseIndex = i;
      totalRepeat = 0;
      expanded.push(s);
      indexMap.push(i);
    }
  }
  flush();

  return { expanded, indexMap };
}

// ── Display grouping ─────────────────────────────────────────────────

export interface PBlock {
  ifLabel: string;
  elseLabel: string;
  ifSteps: DisplayStep[];
  elseSteps: DisplayStep[];
}

export interface DisplayStep {
  dir: string;
  repeat: number;
  rawIndices: number[];
  pBlock?: PBlock;
}

/** Get the if/else labels for a P-block based on the direction card it's attached to */
function pBlockLabels(dir: string): { ifLabel: string; elseLabel: string } {
  return isHorizontalDir(dir)
    ? { ifLabel: "UP", elseLabel: "DOWN" }
    : { ifLabel: "RIGHT", elseLabel: "LEFT" };
}

export function groupProgramForDisplay(program: string[], baseIndex = 0): DisplayStep[] {
  const groups: DisplayStep[] = [];
  for (let i = 0; i < program.length; i++) {
    const s = program[i];
    if (s === "X2" || s === "X3") {
      if (groups.length === 0) continue;
      const last = groups[groups.length - 1];
      const n = s === "X2" ? 2 : 3;
      last.repeat = last.repeat === 1 ? n : last.repeat + n;
      last.rawIndices.push(baseIndex + i);
    } else if (s === "BRANCH") {
      if (groups.length === 0) continue;
      const last = groups[groups.length - 1];
      last.rawIndices.push(baseIndex + i);
      const { ifBody: ifRaw, elseBody: elseRaw, endIndex: j } = splitPBlock(program, i);
      const labels = pBlockLabels(last.dir);
      const ifBaseIdx = baseIndex + i + 1;
      const elseBaseIdx = ifBaseIdx + ifRaw.length + 1;
      last.pBlock = {
        ...labels,
        ifSteps: groupProgramForDisplay(ifRaw, ifBaseIdx),
        elseSteps: groupProgramForDisplay(elseRaw, elseBaseIdx),
      };
      for (let k = i + 1; k <= j; k++) last.rawIndices.push(baseIndex + k);
      i = j;
    } else if (s === "PIPE" || s === "SLASH") {
      // structural tokens — skip at top level
    } else {
      groups.push({ dir: s, repeat: 1, rawIndices: [baseIndex + i] });
    }
  }
  return groups;
}

export function displayStepsToFlat(groups: DisplayStep[]): string[] {
  const result: string[] = [];
  for (const { dir, repeat, pBlock } of groups) {
    result.push(dir);
    if (repeat > 1) {
      let r = repeat;
      if (r % 3 === 1 && r >= 4) { result.push("X2"); r -= 2; }
      while (r >= 3) { result.push("X3"); r -= 3; }
      while (r >= 2) { result.push("X2"); r -= 2; }
    }
    if (pBlock) {
      result.push("BRANCH");
      result.push(...displayStepsToFlat(pBlock.ifSteps));
      result.push("PIPE");
      result.push(...displayStepsToFlat(pBlock.elseSteps));
      result.push("SLASH");
    }
  }
  return result;
}
