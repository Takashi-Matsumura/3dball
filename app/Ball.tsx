"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { useI18n } from "@/lib/i18n";
import {
  CELL_SIZE,
  PatternConfig,
  NFC_DIRECTIONS,
  NFC_ICONS,
  MAX_LOOP_REPEAT,
  moveGrid,
} from "@/lib/ball-shared";
import { encodeProgram, groupProgramForDisplay } from "@/lib/program";
import { SceneLighting, CameraController, Board, Ground, Sphere, CellMarker, TextSprite, ObstacleMarker, BranchMarker } from "@/app/components/Scene";
import { playMove, playJump, playBump, playNfcScan, playSuccess, playBurst, playBranch } from "@/lib/sounds";
import { useLevel } from "@/lib/useLevel";
import { useProgramRunner } from "@/lib/useProgramRunner";
import { gridCenter, LEVELS } from "@/lib/levels";
import { useDemoMode } from "@/lib/useDemoMode";
import { useNfcScanner } from "@/lib/useNfcScanner";
import { InfoButton, InfoOverlay } from "@/app/components/Guide";
import {
  IconRefresh,
  IconX,
  IconSave,
} from "@/app/components/icons";
import { NtagWriteModal } from "@/app/components/NtagWriteModal";
import { SettingsPanel } from "@/app/components/SettingsPanel";
import { ProgrammingPanel } from "@/app/components/ProgrammingPanel";

export default function Ball() {
  const { t, td } = useI18n();
  const level = useLevel();
  const runner = useProgramRunner();
  const { gridPos, setGridPos, isAnimating, setIsAnimating, jumping, setJumping, celebrating, progIndex, resetProgIndex, handleAnimDone, handleJumpDone, handleCelebrateDone } = runner;
  const [is2D, setIs2D] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [patternConfig, setPatternConfig] = useState<PatternConfig>({
    pattern: 0,
    color1: "#4488ff",
    color2: "#ffffff",
    scale: 20,
  });
  const isAnimatingRef = useRef(false);

  // Programming mode
  const [progMode, setProgMode] = useState(false);
  const [program, setProgram] = useState<string[]>([]);
  const [progRunning, setProgRunning] = useState(false);
  const progModeRef = useRef(false);
  const progRunningRef = useRef(false);
  // P-block editing: which branch block is being edited
  const [pBlockEditing, setPBlockEditingState] = useState<"none" | "if" | "else">("none");
  const pBlockEditingRef = useRef<"none" | "if" | "else">("none");
  const setPBlockEditing = useCallback((v: "none" | "if" | "else") => {
    pBlockEditingRef.current = v;
    setPBlockEditingState(v);
  }, []);

  // Info overlay
  const [showInfo, setShowInfo] = useState(false);

  // NTAG write
  const [showNtagModal, setShowNtagModal] = useState(false);
  const [ntagWriting, setNtagWriting] = useState(false);
  const [ntagResult, setNtagResult] = useState<"success" | "error" | null>(null);

  // Auto-demo (attract mode): only on Playground, when no other overlays are active.
  // Note: isAnimating/jumping are intentionally excluded because the demo itself
  // toggles them — including them would make the demo abort its own animations.
  const demoEnabled =
    !level.active &&
    !progMode &&
    !progRunning &&
    !showSettings &&
    !showInfo &&
    !showNtagModal;
  const { demoActive, demoAction, startDemo, cancelDemo } = useDemoMode({
    enabled: demoEnabled,
    gridSize: level.gridSize,
    setGridPos,
    setIsAnimating,
    setJumping,
    setPatternConfig,
  });
  // Track last Escape press time for double-Escape detection
  const lastEscAtRef = useRef(0);

  const displaySteps = useMemo(() => groupProgramForDisplay(program), [program]);

  useEffect(() => { progModeRef.current = progMode; }, [progMode]);
  useEffect(() => { progRunningRef.current = progRunning; }, [progRunning]);

  // Keep ref in sync for NFC polling callback
  useEffect(() => { isAnimatingRef.current = isAnimating; }, [isAnimating]);
  const levelRef = useRef(level);
  useEffect(() => { levelRef.current = level; }, [level]);
  const cancelDemoRef = useRef(cancelDemo);
  useEffect(() => { cancelDemoRef.current = cancelDemo; }, [cancelDemo]);

  // Consecutive branch counter for deadlock detection
  const branchChainRef = useRef(0);

  const { nfcConnected, nfcFlash, setFlash } = useNfcScanner({
    onCard: (cardId) => {
      cancelDemoRef.current();

      // Programming mode: add to program instead of moving
      if (progModeRef.current && !progRunningRef.current) {
        setProgram((prev) => {
          // X2/X3: must have preceding direction
          if ((cardId === "X2" || cardId === "X3") && !prev.some((s) => s !== "X2" && s !== "X3" && s !== "BRANCH" && s !== "PIPE" && s !== "SLASH")) {
            return prev;
          }
          // X2/X3: enforce MAX_LOOP_REPEAT cap per direction
          if (cardId === "X2" || cardId === "X3") {
            const n = cardId === "X2" ? 2 : 3;
            let tailTotal = 0;
            let tailCount = 0;
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i] === "X2") { tailTotal += 2; tailCount++; }
              else if (prev[i] === "X3") { tailTotal += 3; tailCount++; }
              else break;
            }
            const newTotal = tailCount === 0 ? n : tailTotal + n;
            if (newTotal > MAX_LOOP_REPEAT) {
              playBump();
              return prev;
            }
          }
          // BRANCH card: only allowed in Lv3 (levels with branchCount)
          if (cardId === "BRANCH") {
            if (!levelRef.current.config?.branchCount) return prev;
            const lastNonStruct = [...prev].reverse().find((s) => s !== "X2" && s !== "X3");
            if (!lastNonStruct || !["UP", "DOWN", "LEFT", "RIGHT"].includes(lastNonStruct)) return prev;
            if (pBlockEditingRef.current !== "none") return prev;
            pBlockEditingRef.current = "if";
            setPBlockEditingState("if");
            return [...prev, "BRANCH"];
          }
          // Editing P-block body: insert at the correct position
          if (pBlockEditingRef.current !== "none") {
            if (!["UP", "DOWN", "LEFT", "RIGHT", "JUMP", "X2", "X3"].includes(cardId)) return prev;
            const result = [...prev];
            if (pBlockEditingRef.current === "if") {
              const pipeIdx = result.lastIndexOf("PIPE");
              if (pipeIdx >= 0) result.splice(pipeIdx, 0, cardId);
              else result.push(cardId);
            } else {
              const slashIdx = result.lastIndexOf("SLASH");
              if (slashIdx >= 0) result.splice(slashIdx, 0, cardId);
              else result.push(cardId);
            }
            return result;
          }
          return [...prev, cardId];
        });
        playNfcScan();
        setFlash(cardId, 500);
        return;
      }

      // Normal mode: move ball directly
      if (progModeRef.current) return;
      if (isAnimatingRef.current) return;

      // Skip loop/branch cards in free move mode
      if (cardId === "X2" || cardId === "X3" || cardId === "BRANCH") return;

      if (cardId === "JUMP") {
        setJumping(true);
        playJump();
      } else {
        setGridPos((prev) => {
          const next = moveGrid(prev, cardId, levelRef.current.gridSize, levelRef.current.obstacles);
          if (!next) {
            playBump();
            return prev;
          }
          playMove();
          setIsAnimating(true);
          return next;
        });
      }

      setFlash(cardId, 1000);
    },
  });

  // Level: count moves, detect goal/failure, and auto-branch on "?" cells (free-move mode)
  useEffect(() => {
    if (!level.active || level.bursting) return;
    level.countMove(gridPos);
    if (isAnimating || progMode) return;

    // Check for auto-branch on "?" cell (works even after clearing)
    const { isBranch, branchDir } = level.checkBranch(gridPos);
    if (isBranch && branchDir && !jumping) {
      if (!level.cleared) level.setBranchUsed(true);
      branchChainRef.current += 1;
      // Deadlock: 7 consecutive branches → burst (only before clearing)
      if (!level.cleared && branchChainRef.current >= 7) {
        branchChainRef.current = 0;
        level.setBursting(true);
        playBurst();
        return;
      }
      setJumping(true);
      playBranch();
      const tryMove = moveGrid(gridPos, branchDir, level.gridSize, level.obstacles);
      if (tryMove) {
        // Jump-move: jump and move simultaneously (like arrow key during jump)
        setGridPos(tryMove);
        setIsAnimating(true);
        playMove();
      } else {
        // Blocked — bump but keep chain counting
        setTimeout(() => playBump(), 300);
      }
      return;
    }

    // Non-branch cell reached — reset chain counter
    if (!isBranch) {
      branchChainRef.current = 0;
    }

    if (level.cleared) return;

    const result = level.onFreeMove(gridPos, isAnimating);
    if (result === "success") {
      level.setCleared(true);
      playSuccess();
      runner.triggerCelebrate();
    } else if (result === "burst") {
      level.setBursting(true);
      playBurst();
    }
  }, [gridPos, isAnimating, level.active, level.cleared, level.bursting, progMode, jumping]);

  // Run program step by step
  const burstDoneResolveRef = useRef<(() => void) | null>(null);

  const runProgram = useCallback(async (options?: { reverseBranch?: boolean }) => {
    if (program.length === 0) return;
    setProgRunning(true);

    const startPos = level.active ? level.resetForRun().startPos : gridCenter(level.gridSize);
    const { finalPos, passedGoal, burstFromBranch, branchUsed } = await runner.runSteps({
      steps: program,
      startPos,
      gridSize: level.gridSize,
      obstacles: level.obstacles,
      branchCells: level.branchCells,
      isPassthrough: level.active ? level.isPassthrough : undefined,
      reverseBranch: options?.reverseBranch,
      onJump: level.active ? level.addMove : undefined,
    });

    if (burstFromBranch) {
      level.setBursting(true);
      playBurst();
      await new Promise<void>((resolve) => {
        burstDoneResolveRef.current = resolve;
      });
    } else if (level.active) {
      const result = level.checkRunResult(finalPos, passedGoal, branchUsed);
      if (result === "success") {
        level.setCleared(true);
        playSuccess();
        await runner.triggerCelebrate();
      } else {
        level.setBursting(true);
        playBurst();
        await new Promise<void>((resolve) => {
          burstDoneResolveRef.current = resolve;
        });
      }
    } else {
      playSuccess();
    }

    setProgRunning(false);
  }, [program, level, runner]);

  const handleOpenNtagModal = useCallback(() => {
    if (program.length === 0 || !nfcConnected) return;
    setShowNtagModal(true);
    setNtagResult(null);
  }, [program, nfcConnected]);

  const handleStartNtagWrite = useCallback(async () => {
    if (program.length === 0) return;
    const encoded = encodeProgram(program);
    const params = new URLSearchParams({ p: encoded });
    if (patternConfig.color1 !== "#4488ff") params.set("c1", patternConfig.color1.replace("#", ""));
    if (patternConfig.color2 !== "#ffffff") params.set("c2", patternConfig.color2.replace("#", ""));
    if (patternConfig.scale !== 20) params.set("s", String(patternConfig.scale));
    if (patternConfig.pattern !== 0) params.set("pt", String(patternConfig.pattern));
    if (level.active) {
      const lvParams = level.getNtagParams();
      Object.entries(lvParams).forEach(([k, v]) => params.set(k, v));
    }
    params.set("t", String(Math.floor(Date.now() / 1000)));

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    const url = `${baseUrl}/replay?${params.toString()}`;

    setNtagWriting(true);
    setNtagResult(null);
    try {
      const res = await fetch("/api/nfc/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.success) {
        setNtagResult("success");
        const previewUrl = `${window.location.origin}/replay?${params.toString()}`;
        window.open(previewUrl, "_blank");
        setTimeout(() => setShowNtagModal(false), 1500);
      } else {
        setNtagResult("error");
      }
    } catch {
      setNtagResult("error");
    } finally {
      setNtagWriting(false);
      setTimeout(() => setNtagResult(null), 3000);
    }
  }, [program, patternConfig, level]);

  const handleCancelWrite = useCallback(() => {
    fetch("/api/nfc/write", { method: "DELETE" });
    setNtagWriting(false);
    setShowNtagModal(false);
  }, []);

  /** Close the programming panel and clear its state. Used when switching levels. */
  const closeProgMode = useCallback(() => {
    setProgMode(false);
    setProgram([]);
    resetProgIndex();
    setProgRunning(false);
    setPBlockEditing("none");
  }, [resetProgIndex, setPBlockEditing]);

  const handleBurstDone = useCallback(() => {
    // Programming mode: resolve the awaited promise
    if (burstDoneResolveRef.current) {
      level.setBursting(false);
      burstDoneResolveRef.current();
      burstDoneResolveRef.current = null;
    } else if (level.active) {
      // Free move mode: reset to start
      const resetPos = level.onBurstReset();
      setGridPos(resetPos);
      setIsAnimating(false);
    }
  }, [level]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Double-press Escape → start demo. Non-Esc keys cancel demo.
      const isEsc = e.key === "Escape" || e.key === "-";
      if (!isEsc) {
        cancelDemo();
      }
      // Info overlay: intercept all keys while shown
      if (showInfo) {
        e.preventDefault();
        if (e.key === "Escape" || e.key === "i" || e.key === "-") {
          setShowInfo(false);
        }
        return;
      }
      // P → toggle programming mode
      if ((e.key === "p" || e.key === "/") && !e.metaKey && !e.ctrlKey && !progRunning) {
        e.preventDefault();
        if (progMode) {
          closeProgMode();
        } else if (nfcConnected && level.active) {
          setProgMode(true);
        }
        return;
      }
      // I → toggle info overlay
      if (e.key === "i" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowInfo((v) => !v);
        return;
      }
      // S / * → toggle settings
      if ((e.key === "s" || e.key === "*") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowSettings((v) => !v);
        return;
      }
      // D / PageUp(9) → toggle 2D/3D
      if ((e.key === "d" || e.key === "PageUp") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIs2D((v) => !v);
        return;
      }
      // F1..Fn → toggle level mode (mapped to LEVELS order)
      const levelIds = Object.keys(LEVELS);
      const fKeyMatch = e.key.match(/^F(\d+)$/);
      if (fKeyMatch) {
        const idx = Number(fKeyMatch[1]) - 1;
        if (idx >= 0 && idx < levelIds.length) {
          e.preventDefault();
          const id = levelIds[idx];
          if (progMode) closeProgMode();
          if (level.levelId === id) {
            const center = level.deactivate();
            setGridPos(center);
          } else {
            const pos = level.activate(id);
            setGridPos(pos);
          }
          return;
        }
      }
      // Escape / - →
      //   In a level: exit to Playground (first press returns home)
      //   Already on Playground: double-press starts the demo; single press cancels demo
      if (e.key === "Escape" || e.key === "-") {
        e.preventDefault();
        const now = Date.now();
        const isDoublePress = now - lastEscAtRef.current < 500;
        lastEscAtRef.current = now;

        if (level.active) {
          if (progMode) closeProgMode();
          const center = level.deactivate();
          setGridPos(center);
          return;
        }
        // Playground: double-press toggles demo, single-press cancels it if running
        if (demoActive) {
          cancelDemo();
        } else if (isDoublePress) {
          startDemo();
        }
        return;
      }
      // + → cycle level (OFF→Lv1→Lv2→Lv3→OFF)
      if (e.key === "+" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const currentIdx = level.levelId ? levelIds.indexOf(level.levelId) : -1;
        const nextIdx = currentIdx + 1;
        if (progMode) closeProgMode();
        if (nextIdx >= levelIds.length) {
          const center = level.deactivate();
          setGridPos(center);
        } else {
          const pos = level.activate(levelIds[nextIdx]);
          setGridPos(pos);
        }
        return;
      }
      // Tab → generate challenge (hasChallenge) or new map (!hasChallenge)
      if ((e.key === "Tab" || e.key === "Delete") && level.active && !level.cleared && !progMode) {
        e.preventDefault();
        if (level.config?.hasChallenge) {
          const pos = level.newChallenge();
          setGridPos(pos);
          setIsAnimating(false);
        } else {
          const pos = level.generate();
          setGridPos(pos);
        }
        return;
      }
      // Space → next challenge when level cleared (non-prog mode)
      if ((e.key === " " || e.code === "Space" || e.key === "Clear") && level.cleared && !progMode) {
        e.preventDefault();
        const pos = level.generate();
        setGridPos(pos);
        return;
      }
      // Programming mode shortcuts
      if (progMode) {
        // Swallow Enter so focused buttons don't re-trigger via browser default
        if (e.key === "Enter") {
          e.preventDefault();
          if (!progRunning && program.length > 0) {
            if (e.shiftKey) runProgram({ reverseBranch: true });
            else runProgram();
          }
          return;
        }
        // Arrow keys → switch if/else focus during P-block editing
        if (pBlockEditing !== "none" && !progRunning) {
          const arrowMap: Record<string, string> = {
            ArrowUp: "UP",
            ArrowDown: "DOWN",
            ArrowLeft: "LEFT",
            ArrowRight: "RIGHT",
          };
          const dir = arrowMap[e.key];
          if (dir) {
            e.preventDefault();
            const pBlockGroup = displaySteps.find((g) => g.pBlock);
            const pb = pBlockGroup?.pBlock;
            if (pb) {
              if (dir === pb.ifLabel) {
                setPBlockEditing("if");
              } else if (dir === pb.elseLabel) {
                if (!program.includes("PIPE")) {
                  setProgram((prev) => [...prev, "PIPE"]);
                }
                setPBlockEditing("else");
              }
            }
            return;
          }
        }
        // Space / Insert → New (clear program & regenerate)
        if ((e.key === " " || e.code === "Space" || e.key === "Clear" || e.key === "Insert") && !progRunning) {
          e.preventDefault();
          setProgram([]);
          resetProgIndex();
          setPBlockEditing("none");
          if (level.active) {
            const pos = level.generate();
            setGridPos(pos);
          } else {
            setGridPos(gridCenter(level.gridSize));
          }
          return;
        }
        return;
      }
      if (isAnimating || level.bursting) return;
      if (e.key === " " || e.code === "Space" || e.key === "Clear") {
        e.preventDefault();
        if (!jumping) {
          setJumping(true);
          playJump();
          if (level.active && !level.cleared) {
            level.addMove();
            const result = level.onFreeMove(gridPos, false);
            if (result === "burst") {
              level.setBursting(true);
              playBurst();
            }
          }
        }
        return;
      }
      const keyMap: Record<string, string> = {
        ArrowUp: "UP",
        ArrowDown: "DOWN",
        ArrowLeft: "LEFT",
        ArrowRight: "RIGHT",
      };
      const direction = keyMap[e.key];
      if (!direction) return;
      e.preventDefault();
      setGridPos((prev) => {
        const next = moveGrid(prev, direction, level.gridSize, level.obstacles);
        if (!next) {
          playBump();
          return prev;
        }
        playMove();
        setIsAnimating(true);
        return next;
      });
    },
    [isAnimating, jumping, progMode, progRunning, program, runProgram, level, pBlockEditing, displaySteps, showInfo, cancelDemo, startDemo, demoActive, closeProgMode]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="relative h-screen w-screen" onPointerDown={cancelDemo}>
      <ProgrammingPanel
        open={progMode}
        onOpen={() => setProgMode(true)}
        onClose={closeProgMode}
        onNew={() => {
          setProgram([]);
          resetProgIndex();
          setPBlockEditing("none");
          if (level.active) {
            const pos = level.generate();
            setGridPos(pos);
          } else {
            setGridPos(gridCenter(level.gridSize));
          }
        }}
        onRun={() => runProgram()}
        running={progRunning}
        nfcConnected={nfcConnected}
        levelActive={level.active}
        program={program}
        setProgram={setProgram}
        displaySteps={displaySteps}
        progIndex={progIndex}
        pBlockEditing={pBlockEditing}
        setPBlockEditing={setPBlockEditing}
      />

      {/* Level HUD — bottom center, above footer */}
      {level.active && (
        <div className="absolute bottom-12 left-0 right-0 z-10 flex flex-col items-center gap-2">
          {/* Challenge card — prominent target display with embedded action buttons */}
          {level.challenge !== null && (!level.cleared || progMode) && level.config && (
            <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-b from-yellow-400/95 to-yellow-500/95 px-5 py-3 shadow-xl ring-2 ring-yellow-300/60 backdrop-blur">
              <div className="flex items-baseline gap-1.5 text-black">
                <span className="text-xs font-bold tracking-wide text-black/70">
                  {t("lv1Challenge")}
                </span>
                <span className="text-4xl font-black leading-none">{level.challenge}</span>
                <span className="text-sm font-bold text-black/70">
                  {td(level.config.challengeThemeKey)}
                </span>
              </div>
              {/* Progress pips: filled = moves used, empty = remaining */}
              <div className="flex flex-wrap justify-center gap-1 max-w-[260px]">
                {Array.from({ length: level.challenge }).map((_, i) => {
                  const used = i < level.moves;
                  const over = i < level.moves && level.moves > level.challenge!;
                  return (
                    <span
                      key={i}
                      className={`inline-block w-3 h-3 rounded-full border-2 transition ${
                        over
                          ? "bg-red-500 border-red-600"
                          : used
                            ? "bg-black border-black"
                            : "bg-transparent border-black/40"
                      }`}
                    />
                  );
                })}
                {/* Overflow pips when moves exceed target */}
                {level.moves > level.challenge && Array.from({ length: level.moves - level.challenge }).map((_, i) => (
                  <span key={`over-${i}`} className="inline-block w-3 h-3 rounded-full bg-red-500 border-2 border-red-600" />
                ))}
              </div>
              <div className="text-xs font-bold text-black/80">
                {level.moves} / {level.challenge}
              </div>
              {/* Embedded action buttons: update / clear */}
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => {
                    const pos = level.newChallenge();
                    setGridPos(pos);
                    setIsAnimating(false);
                  }}
                  aria-label={t("challengeUpdate")}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold bg-black/15 text-black hover:bg-black/25 active:bg-black/35 transition"
                >
                  <IconRefresh className="w-3.5 h-3.5" />
                  {t("challengeUpdate")}
                  <kbd className="rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-mono text-black/70">Tab</kbd>
                </button>
                <button
                  onClick={() => {
                    const pos = level.clearChallenge();
                    setGridPos(pos);
                    setIsAnimating(false);
                  }}
                  aria-label={t("challengeClear")}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold bg-black/15 text-black hover:bg-red-100 active:bg-red-200 transition"
                >
                  <IconX className="w-3.5 h-3.5" />
                  {t("challengeClear")}
                </button>
              </div>
            </div>
          )}
          {/* Theme text — only when no challenge is set */}
          {level.challenge === null && (!level.cleared || progMode) && level.config && (
            <div className="text-xl font-bold text-yellow-300 drop-shadow-md" style={{ textShadow: "0 0 10px rgba(255,200,0,0.6)" }}>
              {td(level.config.themeKey)}
            </div>
          )}
          {/* Action buttons row */}
          <div className="flex items-center gap-2 mt-1">
            {/* お題 button: only show when no challenge is set yet */}
            {level.config?.hasChallenge && level.challenge === null && (!level.cleared || progMode) && (
              <button
                onClick={() => {
                  const pos = level.newChallenge();
                  setGridPos(pos);
                  setIsAnimating(false);
                }}
                className="flex items-center gap-1.5 rounded px-3 py-1 text-xs font-bold bg-white/20 text-white/80 hover:bg-white/30 transition backdrop-blur"
              >
                {t("lv1Challenge")}
                <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono text-white/60">Tab</kbd>
              </button>
            )}
            {!level.config?.hasChallenge && !level.cleared && !progMode && (
              <button
                onClick={() => {
                  const pos = level.generate();
                  setGridPos(pos);
                }}
                className="flex items-center gap-1.5 rounded px-3 py-1 text-xs font-bold bg-white/20 text-white/80 hover:bg-white/30 transition backdrop-blur"
              >
                {t("newMap")}
                <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono text-white/60">Tab</kbd>
              </button>
            )}
            {level.cleared && !progMode && (
              <button
                onClick={() => {
                  const pos = level.generate();
                  setGridPos(pos);
                }}
                className="flex items-center gap-2 rounded-lg px-6 py-3 text-xl font-bold bg-yellow-400/90 text-black hover:bg-yellow-400 transition backdrop-blur shadow-lg animate-pulse"
              >
                {t("nextChallenge")}
                <kbd className="rounded bg-black/15 px-2 py-0.5 text-sm font-mono text-black/60">Space</kbd>
              </button>
            )}
          </div>
        </div>
      )}

      <SettingsPanel
        open={showSettings}
        setOpen={setShowSettings}
        is2D={is2D}
        setIs2D={setIs2D}
        patternConfig={patternConfig}
        setPatternConfig={setPatternConfig}
      />

      {/* Footer — NFC status + NTAG save */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center px-4 py-2 bg-black/50 backdrop-blur">
        <div className="flex-1 flex gap-1">
          {!progMode && Object.keys(LEVELS).map((id) => (
            <button
              key={id}
              onClick={() => {
                if (level.levelId === id) {
                  const center = level.deactivate();
                  setGridPos(center);
                } else {
                  const pos = level.activate(id);
                  setGridPos(pos);
                }
              }}
              className={`rounded px-2 py-0.5 text-xs font-bold transition ${
                level.levelId === id
                  ? "bg-yellow-400 text-black"
                  : "bg-white/20 text-white/60 hover:bg-white/30"
              }`}
            >
              {td(LEVELS[id].labelKey)}
              <kbd className="ml-1 rounded bg-white/15 px-1 py-0.5 text-[9px] font-mono opacity-60">{`F${Object.keys(LEVELS).indexOf(id) + 1}`}</kbd>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-white/80">
          <InfoButton onClick={() => setShowInfo(true)} />
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              nfcConnected ? "bg-green-400 animate-pulse" : "bg-gray-500"
            }`}
          />
          {nfcConnected ? t("nfcConnected") : t("nfcDisconnected")}
        </div>
        <div className="flex-1 flex justify-end">
          {progMode && program.length > 0 && nfcConnected && !progRunning && (
            <button
              onClick={handleOpenNtagModal}
              className="text-white/30 hover:text-white/70 transition"
              title={t("saveToNtag")}
            >
              <IconSave className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {showNtagModal && (
        <NtagWriteModal
          writing={ntagWriting}
          result={ntagResult}
          onStart={handleStartNtagWrite}
          onCancel={handleCancelWrite}
          onClose={() => setShowNtagModal(false)}
        />
      )}

      {/* Info overlay */}
      {showInfo && (
        <InfoOverlay levelId={level.levelId} onClose={() => setShowInfo(false)} />
      )}

      {/* NFC flash */}
      {nfcFlash && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="rounded-xl bg-white/90 px-4 py-3 shadow-xl backdrop-blur text-center animate-bounce">
            <div className="text-2xl">{NFC_ICONS[nfcFlash]}</div>
            <div className="text-xs font-bold text-gray-700">{nfcFlash}</div>
          </div>
        </div>
      )}

      {/* Auto-demo hint */}
      {demoActive && demoAction && !nfcFlash && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="rounded-xl bg-white/80 px-5 py-3 shadow-xl backdrop-blur text-center transition-opacity duration-200">
            <div className="text-4xl leading-none">{NFC_ICONS[demoAction]}</div>
            <div className="text-sm font-bold text-gray-700 mt-1">
              {t(
                demoAction === "UP" ? "demoKeyUp" :
                demoAction === "DOWN" ? "demoKeyDown" :
                demoAction === "LEFT" ? "demoKeyLeft" :
                demoAction === "RIGHT" ? "demoKeyRight" :
                "demoKeyJump"
              )}
            </div>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [0, 5, 5], fov: 45 }} gl={{ antialias: true }} shadows>
        <SceneLighting gridSize={level.gridSize} />
        <CameraController is2D={is2D} gridSize={level.gridSize} />
        <Ground />
        <Board gridSize={level.gridSize} />
        {level.active && (!level.cleared || progMode) && (
          <>
            <CellMarker col={level.start.col} row={level.start.row} color="#44cc44" gridSize={level.gridSize} />
            <TextSprite col={level.start.col} row={level.start.row} text={t("start")} color="#44cc44" gridSize={level.gridSize} />
            <CellMarker col={level.goal.col} row={level.goal.row} color="#ffaa00" gridSize={level.gridSize} />
            <TextSprite col={level.goal.col} row={level.goal.row} text={t("goal")} color="#ffaa00" gridSize={level.gridSize} />
          </>
        )}
        {level.active && (
          <>
            {level.obstacles.map((ob, i) => (
              <ObstacleMarker key={`ob-${i}`} col={ob.col} row={ob.row} gridSize={level.gridSize} />
            ))}
            {level.branchCells.map((bc, i) => (
              <BranchMarker key={`br-${i}`} branchCell={bc} gridSize={level.gridSize} />
            ))}
          </>
        )}
        <Sphere
          gridCol={gridPos.col}
          gridRow={gridPos.row}
          jumping={jumping}
          bursting={level.bursting}
          celebrating={celebrating}
          onAnimDone={handleAnimDone}
          onJumpDone={handleJumpDone}
          onBurstDone={handleBurstDone}
          onCelebrateDone={handleCelebrateDone}
          patternConfig={patternConfig}
          gridSize={level.gridSize}
        />
      </Canvas>
    </div>
  );
}
