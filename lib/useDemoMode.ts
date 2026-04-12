"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { moveGrid, COLOR_PRESETS, PatternConfig } from "./ball-shared";
import { playMove, playJump } from "./sounds";

const MOVE_ANIM_MS = 260;   // Matches Sphere animation duration
const BETWEEN_MS = 600;     // Pause between actions
const JUMP_ANIM_MS = 500;
const SCALE_MIN = 2;
const SCALE_MAX = 20;

type GridPos = { col: number; row: number };
type DemoAction = "UP" | "DOWN" | "LEFT" | "RIGHT" | "JUMP";

const DIRS: Exclude<DemoAction, "JUMP">[] = ["UP", "DOWN", "LEFT", "RIGHT"];

interface UseDemoModeOptions {
  enabled: boolean;
  gridSize: number;
  setGridPos: (updater: (prev: GridPos) => GridPos) => void;
  setIsAnimating: (v: boolean) => void;
  setJumping: (v: boolean) => void;
  setPatternConfig: (updater: (prev: PatternConfig) => PatternConfig) => void;
}

interface UseDemoModeResult {
  demoActive: boolean;
  demoAction: DemoAction | null;
  startDemo: () => void;
  cancelDemo: () => void;
}

function sleep(ms: number, aborted: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (aborted()) return resolve();
      const elapsed = Date.now() - start;
      if (elapsed >= ms) return resolve();
      setTimeout(tick, Math.min(50, ms - elapsed));
    };
    tick();
  });
}

export function useDemoMode({
  enabled,
  gridSize,
  setGridPos,
  setIsAnimating,
  setJumping,
  setPatternConfig,
}: UseDemoModeOptions): UseDemoModeResult {
  const [demoActive, setDemoActive] = useState(false);
  const [demoAction, setDemoAction] = useState<DemoAction | null>(null);

  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const runningRef = useRef(false);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const runDemo = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    const ctl = { aborted: false };
    abortRef.current = ctl;
    setDemoActive(true);

    // Loop until aborted
    let actionCount = 0;
    let currentPos: GridPos | null = null;
    let savedPattern: PatternConfig | null = null;
    let lastColor1: string | null = null;

    // Capture the ball's starting pos via setGridPos pattern
    setGridPos((prev) => {
      currentPos = prev;
      return prev;
    });
    // Capture the original pattern config so we can restore it later
    setPatternConfig((prev) => {
      savedPattern = prev;
      lastColor1 = prev.color1;
      return prev;
    });

    // Wait one tick for setGridPos capture
    await sleep(20, () => ctl.aborted);

    while (!ctl.aborted && enabledRef.current) {
      // Every 8th action, do a jump
      const doJump = actionCount > 0 && actionCount % 8 === 0;

      if (doJump) {
        setDemoAction("JUMP");
        setPatternConfig((prev) => {
          // Pick a new color1 that's not the previous color1 and not color2
          const candidates = COLOR_PRESETS.filter(
            (c) => c !== lastColor1 && c !== prev.color2,
          );
          const nextColor =
            candidates[Math.floor(Math.random() * candidates.length)];
          lastColor1 = nextColor;
          // Pick a new scale different from the previous one (within UI range)
          let nextScale = prev.scale;
          for (let i = 0; i < 6 && nextScale === prev.scale; i++) {
            nextScale =
              SCALE_MIN + Math.floor(Math.random() * (SCALE_MAX - SCALE_MIN + 1));
          }
          return {
            ...prev,
            pattern: prev.pattern === 0 ? 1 : 0,
            color1: nextColor,
            scale: nextScale,
          };
        });
        setJumping(true);
        playJump();
        await sleep(JUMP_ANIM_MS, () => ctl.aborted);
      } else {
        // Pick a valid direction (up to 4 tries)
        let chosenDir: Exclude<DemoAction, "JUMP"> | null = null;
        let nextPos: GridPos | null = null;
        const tried = new Set<string>();
        for (let i = 0; i < 4 && !chosenDir; i++) {
          const remaining = DIRS.filter((d) => !tried.has(d));
          if (remaining.length === 0) break;
          const candidate = remaining[Math.floor(Math.random() * remaining.length)];
          tried.add(candidate);
          if (!currentPos) break;
          const result = moveGrid(currentPos, candidate, gridSize);
          if (result) {
            chosenDir = candidate;
            nextPos = result;
          }
        }

        if (!chosenDir || !nextPos) {
          // Cannot move anywhere (shouldn't happen on open grid)
          await sleep(BETWEEN_MS, () => ctl.aborted);
          actionCount++;
          continue;
        }

        setDemoAction(chosenDir);
        const target = nextPos;
        setGridPos(() => target);
        setIsAnimating(true);
        playMove();
        currentPos = target;
        await sleep(MOVE_ANIM_MS, () => ctl.aborted);
      }

      actionCount++;
      if (ctl.aborted) break;
      await sleep(BETWEEN_MS, () => ctl.aborted);
    }

    runningRef.current = false;
    setDemoActive(false);
    setDemoAction(null);
    // Restore the original pattern config
    if (savedPattern) {
      const restored = savedPattern;
      setPatternConfig(() => restored);
    }
  }, [gridSize, setGridPos, setIsAnimating, setJumping, setPatternConfig]);

  const startDemo = useCallback(() => {
    if (!enabledRef.current) return;
    if (runningRef.current) return;
    runDemo();
  }, [runDemo]);

  const cancelDemo = useCallback(() => {
    if (runningRef.current) {
      // Flip abort flag synchronously; the running loop exits on its own
      // and restores state (including the original pattern config).
      abortRef.current.aborted = true;
    }
  }, []);

  // Abort the demo if it is running when enabled flips to false
  useEffect(() => {
    if (!enabled && runningRef.current) {
      abortRef.current.aborted = true;
    }
  }, [enabled]);

  return { demoActive, demoAction, startDemo, cancelDemo };
}
