import * as THREE from "three";

export const CELL_SIZE = 1.2;
export const BALL_RADIUS = 0.4;

export const COLOR_PRESETS = [
  "#ff0000", "#ff8800", "#ffcc00", "#00cc00", "#0088ff",
  "#4488ff", "#8844ff", "#ff44aa", "#ffffff", "#000000",
];

export interface PatternConfig {
  pattern: number;
  color1: string;
  color2: string;
  scale: number;
}

export function makeShaderMaterial(config: PatternConfig) {
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

export const CAMERA_3D = {
  pos: [0, 3, 6] as const,
  lookAt: [0, 0, 0] as const,
  up: [0, 1, 0] as const,
};
export const CAMERA_2D = {
  pos: [0, 7, 0] as const,
  lookAt: [0, 0, 0] as const,
  up: [0, 0, -1] as const,
};

export const NFC_DIRECTIONS = ["UP", "DOWN", "LEFT", "RIGHT", "JUMP"] as const;
export const NFC_ICONS: Record<string, string> = { UP: "⬆", DOWN: "⬇", LEFT: "⬅", RIGHT: "➡", JUMP: "⤴" };

export function moveGrid(
  prev: { col: number; row: number },
  direction: string,
  gridSize: number = 3,
): { col: number; row: number } | null {
  const maxIdx = gridSize - 1;
  let { col, row } = prev;
  switch (direction) {
    case "UP":
      row = Math.max(0, row - 1);
      break;
    case "DOWN":
      row = Math.min(maxIdx, row + 1);
      break;
    case "LEFT":
      col = Math.max(0, col - 1);
      break;
    case "RIGHT":
      col = Math.min(maxIdx, col + 1);
      break;
    default:
      return null;
  }
  if (col === prev.col && row === prev.row) return null;
  return { col, row };
}

/** Generate a random path from start to goal on the 3x3 grid.
 *  Sometimes takes detours to make it more interesting. */
export function generateRandomPath(
  start: { col: number; row: number },
  goal: { col: number; row: number },
  gridSize: number = 3,
): string[] {
  const DIRS = ["UP", "DOWN", "LEFT", "RIGHT"];
  const path: string[] = [];
  let pos = { ...start };

  // Decide if we add detour steps (50% chance, 1-3 extra moves)
  const detourCount = Math.random() < 0.5 ? 0 : 1 + Math.floor(Math.random() * 3);

  // Add random detour moves first
  for (let i = 0; i < detourCount; i++) {
    // Pick a random valid move
    const valid = DIRS.filter((d) => {
      const next = moveGrid(pos, d, gridSize);
      return next !== null;
    });
    if (valid.length === 0) break;
    const dir = valid[Math.floor(Math.random() * valid.length)];
    path.push(dir);
    pos = moveGrid(pos, dir, gridSize)!;
  }

  // Now walk toward the goal (greedy with random axis priority)
  let safety = 20;
  while ((pos.col !== goal.col || pos.row !== goal.row) && safety-- > 0) {
    const candidates: string[] = [];
    if (pos.col < goal.col) candidates.push("RIGHT");
    if (pos.col > goal.col) candidates.push("LEFT");
    if (pos.row < goal.row) candidates.push("DOWN");
    if (pos.row > goal.row) candidates.push("UP");
    if (candidates.length === 0) break;
    const dir = candidates[Math.floor(Math.random() * candidates.length)];
    path.push(dir);
    pos = moveGrid(pos, dir, gridSize)!;
  }

  return path;
}

const DIRECTION_CHARS: Record<string, string> = { UP: "U", DOWN: "D", LEFT: "L", RIGHT: "R", JUMP: "J" };
const CHAR_DIRECTIONS: Record<string, string> = { U: "UP", D: "DOWN", L: "LEFT", R: "RIGHT", J: "JUMP" };

export function encodeProgram(steps: string[]): string {
  return steps.map((s) => DIRECTION_CHARS[s] || "").join("");
}

export function decodeProgram(encoded: string): string[] {
  return encoded.split("").map((c) => CHAR_DIRECTIONS[c]).filter(Boolean);
}
