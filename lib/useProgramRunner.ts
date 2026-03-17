"use client";

import { useRef, useState, useCallback } from "react";
import { moveGrid, expandProgramWithMap } from "@/lib/ball-shared";
import { GridPos } from "@/lib/levels";
import { playMove, playJump } from "@/lib/sounds";

export interface RunConfig {
  steps: string[];
  startPos: GridPos;
  gridSize: number;
  obstacles: GridPos[];
  /** Called on intermediate steps to check if goal was passed through */
  isPassthrough?: (pos: GridPos, stepIndex: number, totalSteps: number) => boolean;
}

export interface RunResult {
  finalPos: GridPos;
  passedGoal: boolean;
}

export function useProgramRunner() {
  const [gridPos, setGridPos] = useState<GridPos>({ col: 1, row: 1 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [progIndex, setProgIndex] = useState(-1);

  const animDoneResolveRef = useRef<(() => void) | null>(null);
  const jumpDoneResolveRef = useRef<(() => void) | null>(null);

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

  /** Run program steps with animations. Returns final position and passedGoal flag. */
  const runSteps = useCallback(async (config: RunConfig): Promise<RunResult> => {
    const { steps, startPos, gridSize, obstacles, isPassthrough } = config;

    setGridPos(startPos);
    setIsAnimating(false);
    setProgIndex(-1);
    await new Promise((r) => setTimeout(r, 100));

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
          if (isPassthrough?.(next, i, expanded.length)) {
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

    return { finalPos: currentPos, passedGoal };
  }, []);

  /** Trigger a jump and wait for it to complete */
  const triggerJump = useCallback(async () => {
    setJumping(true);
    playJump();
    await new Promise<void>((resolve) => {
      jumpDoneResolveRef.current = resolve;
    });
  }, []);

  /** Reset highlight index (e.g. when closing programming panel) */
  const resetProgIndex = useCallback(() => setProgIndex(-1), []);

  return {
    gridPos,
    setGridPos,
    isAnimating,
    setIsAnimating,
    jumping,
    setJumping,
    progIndex,
    resetProgIndex,
    handleAnimDone,
    handleJumpDone,
    runSteps,
    triggerJump,
  };
}
