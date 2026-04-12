"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { useI18n, Locale } from "@/lib/i18n";
import {
  CELL_SIZE,
  COLOR_PRESETS,
  PatternConfig,
  NFC_DIRECTIONS,
  NFC_ICONS,
  MAX_LOOP_REPEAT,
  moveGrid,
  encodeProgram,
  groupProgramForDisplay,
  displayStepsToFlat,
} from "@/lib/ball-shared";
import { SceneLighting, CameraController, Board, Ground, Sphere, CellMarker, TextSprite, ObstacleMarker, BranchMarker } from "@/app/components/Scene";
import { playMove, playJump, playBump, playNfcScan, playSuccess, playBurst, playBranch } from "@/lib/sounds";
import { useLevel } from "@/lib/useLevel";
import { useProgramRunner } from "@/lib/useProgramRunner";
import { gridCenter, LEVELS } from "@/lib/levels";
import { useDemoMode } from "@/lib/useDemoMode";
import { InfoButton, InfoOverlay } from "@/app/components/Guide";

export default function Ball() {
  const { locale, setLocale, t, td } = useI18n();
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
  const [nfcConnected, setNfcConnected] = useState(false);
  const [nfcFlash, setNfcFlash] = useState<string | null>(null);
  const isAnimatingRef = useRef(false);

  // Programming mode
  const [progMode, setProgMode] = useState(false);
  const [program, setProgram] = useState<string[]>([]);
  const [progRunning, setProgRunning] = useState(false);
  const progModeRef = useRef(false);
  const progStepsRef = useRef<HTMLDivElement>(null);
  const progRunningRef = useRef(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
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

  // Auto-scroll to highlighted step
  useEffect(() => {
    if (progIndex < 0 || !progStepsRef.current) return;
    const gi = displaySteps.findIndex((g) => g.rawIndices.includes(progIndex));
    if (gi < 0) return;
    const el = progStepsRef.current.children[gi] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [progIndex, displaySteps]);

  // Auto-scroll to the newest card when the program grows (not during execution)
  const prevProgLenRef = useRef(0);
  useEffect(() => {
    if (progRunning) {
      prevProgLenRef.current = program.length;
      return;
    }
    if (program.length > prevProgLenRef.current && progStepsRef.current) {
      progStepsRef.current.scrollTo({
        top: progStepsRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    prevProgLenRef.current = program.length;
  }, [program.length, progRunning]);

  // Keep ref in sync for NFC polling callback
  useEffect(() => { isAnimatingRef.current = isAnimating; }, [isAnimating]);
  const levelRef = useRef(level);
  useEffect(() => { levelRef.current = level; }, [level]);
  const cancelDemoRef = useRef(cancelDemo);
  useEffect(() => { cancelDemoRef.current = cancelDemo; }, [cancelDemo]);

  // Consecutive branch counter for deadlock detection
  const branchChainRef = useRef(0);

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

  // NFC polling
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/nfc/read");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setNfcConnected(data.connected);

        for (const ev of data.events) {
          const cardId = ev.cardId as string;
          if (!NFC_DIRECTIONS.includes(cardId as typeof NFC_DIRECTIONS[number])) continue;

          // Cancel auto-demo on any NFC card scan
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
                // No nested P: if already inside a P-block, reject
                if (pBlockEditingRef.current !== "none") return prev;
                // Start P-block editing
                pBlockEditingRef.current = "if";
                setPBlockEditingState("if");
                return [...prev, "BRANCH"];
              }
              // Editing P-block body: insert at the correct position
              if (pBlockEditingRef.current !== "none") {
                if (!["UP", "DOWN", "LEFT", "RIGHT", "JUMP", "X2", "X3"].includes(cardId)) return prev;
                const result = [...prev];
                if (pBlockEditingRef.current === "if") {
                  // Insert before PIPE (or at end if no PIPE yet)
                  const pipeIdx = result.lastIndexOf("PIPE");
                  if (pipeIdx >= 0) {
                    result.splice(pipeIdx, 0, cardId);
                  } else {
                    result.push(cardId);
                  }
                } else {
                  // Insert before SLASH (or at end if no SLASH yet)
                  const slashIdx = result.lastIndexOf("SLASH");
                  if (slashIdx >= 0) {
                    result.splice(slashIdx, 0, cardId);
                  } else {
                    result.push(cardId);
                  }
                }
                return result;
              }
              return [...prev, cardId];
            });
            playNfcScan();
            setNfcFlash(cardId);
            setTimeout(() => { if (!cancelled) setNfcFlash(null); }, 500);
            continue;
          }

          // Normal mode: move ball directly
          if (progModeRef.current) continue; // skip during run
          if (isAnimatingRef.current) continue;

          // Skip loop/branch cards in free move mode
          if (cardId === "X2" || cardId === "X3" || cardId === "BRANCH") continue;

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

          setNfcFlash(cardId);
          setTimeout(() => { if (!cancelled) setNfcFlash(null); }, 1000);
        }
      } catch {
        // ignore
      }
    };
    poll();
    const id = setInterval(poll, 400);
    return () => { cancelled = true; clearInterval(id); };
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
          setProgMode(false);
          setProgram([]);
          resetProgIndex();
          setProgRunning(false);
          setPBlockEditing("none");
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
      // J/E/N → switch language
      if ((e.key === "j" || e.key === "e" || e.key === "n") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setLocale(e.key === "j" ? "ja" : e.key === "e" ? "en" : "es");
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
      if ((e.key === "Tab" || e.key === "Delete") && level.active && !level.cleared) {
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
    [isAnimating, jumping, progMode, progRunning, program, runProgram, level, pBlockEditing, showInfo, cancelDemo, startDemo, demoActive, closeProgMode]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="relative h-screen w-screen" onPointerDown={cancelDemo}>
      {/* Programming panel — left */}
      <div className={`absolute top-4 left-4 ${progMode ? "z-20 bottom-12 flex flex-col" : "z-10"}`}>
        {/* Panel header */}
        {!progMode ? (level.active && (
          <button
            onClick={() => nfcConnected && setProgMode(true)}
            className={`rounded-lg bg-white/95 p-2 shadow-md backdrop-blur border border-gray-200 transition ${nfcConnected ? "hover:bg-white text-black/40 hover:text-black/70" : "text-black/15 cursor-not-allowed"}`}
            title={t("programming")}
            disabled={!nfcConnected}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
        )) : (
          <div className="w-64 flex items-center bg-white/95 rounded-lg shadow-md backdrop-blur border border-gray-200 overflow-hidden">
            <button
              onClick={() => {
                setProgMode(false);
                setProgram([]);
                resetProgIndex();
                setProgRunning(false);
                setPBlockEditing("none");
              }}
              className="px-3 py-2 transition border-r border-gray-200 bg-gray-200 hover:bg-gray-300 text-black/70"
              title={t("close")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <span className="flex-1 px-3 py-2 text-sm font-bold text-gray-700">{t("programming")}</span>
          </div>
        )}

        {/* Panel body */}
        {progMode && (
          <div className="w-64 mt-1 flex flex-col flex-1 min-h-0 bg-white/95 rounded-lg shadow-md backdrop-blur border border-gray-200 overflow-hidden">
            {/* New button */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
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
              disabled={progRunning}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gray-600 hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              New
              <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono text-white/60">Space</kbd>
            </button>

            {/* Program steps */}
            <div ref={progStepsRef} className="flex-1 overflow-y-auto min-h-[120px] px-2 py-2 flex flex-col gap-1">
              {displaySteps.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8 whitespace-pre-line">
                  {t("scanCardToAdd")}
                </p>
              ) : (
                displaySteps.map((group, gi) => {
                  const isHighlighted = group.rawIndices.includes(progIndex);
                  return (
                    <div key={gi}>
                      {/* Main step row */}
                      <div
                        draggable={!progRunning && !group.pBlock}
                        onDragStart={() => setDragIndex(gi)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIndex(gi); }}
                        onDragEnd={() => {
                          if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
                            const reordered = [...displaySteps];
                            const [item] = reordered.splice(dragIndex, 1);
                            reordered.splice(dragOverIndex, 0, item);
                            setProgram(displayStepsToFlat(reordered));
                          }
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          isHighlighted
                            ? "bg-yellow-300 scale-105"
                            : dragOverIndex === gi && dragIndex !== null && dragIndex !== gi
                              ? "bg-blue-100 border-t-2 border-blue-400"
                              : dragIndex === gi
                                ? "bg-gray-200 opacity-50"
                                : "bg-gray-100"
                        }`}
                        style={{ cursor: progRunning ? "default" : group.pBlock ? "default" : "grab" }}
                      >
                        {!progRunning && !group.pBlock && (
                          <span className="text-gray-300 text-xs cursor-grab select-none">☰</span>
                        )}
                        <span className="text-xs text-gray-400 w-4 text-right">{gi + 1}</span>
                        <span className="text-lg">{NFC_ICONS[group.dir]}</span>
                        <span className="text-xs text-gray-600">{group.dir}</span>
                        {group.repeat > 1 && (
                          <span className="text-xs font-bold text-pink-600">×{group.repeat}</span>
                        )}
                        {group.pBlock && (
                          <span className="text-xs font-bold text-purple-600">🔀</span>
                        )}
                        {!progRunning && (
                          <button
                            onClick={() => {
                              const groups = groupProgramForDisplay(program);
                              groups.splice(gi, 1);
                              setProgram(displayStepsToFlat(groups));
                              setPBlockEditing("none");
                            }}
                            aria-label="削除"
                            className="ml-auto flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-500 active:bg-red-200 text-lg font-bold transition"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* P-block if/else UI */}
                      {group.pBlock && (() => {
                        const ifActive = group.pBlock!.ifSteps.some((sub) => sub.rawIndices.includes(progIndex));
                        const elseActive = group.pBlock!.elseSteps.some((sub) => sub.rawIndices.includes(progIndex));
                        return (
                        <div className="ml-4 mt-1 mb-1 border-l-2 border-purple-300 pl-2 flex flex-col gap-1">
                          {/* if block */}
                          <div
                            onClick={() => !progRunning && setPBlockEditing("if")}
                            className={`rounded px-2 py-1 text-xs font-bold ${
                              ifActive ? "bg-yellow-200 ring-2 ring-yellow-400"
                              : pBlockEditing === "if" ? "bg-purple-100 ring-2 ring-purple-400" : "bg-gray-50 hover:bg-purple-50"
                            } ${!progRunning ? "cursor-pointer" : ""}`}
                          >
                            <span className="text-purple-600">{t("ifBlock")} ({NFC_ICONS[group.pBlock!.ifLabel]} {group.pBlock!.ifLabel})</span>
                          </div>
                          {group.pBlock!.ifSteps.length > 0 ? (
                            group.pBlock!.ifSteps.map((sub, si) => {
                              const isSubHighlighted = sub.rawIndices.includes(progIndex);
                              return (
                              <div key={`if-${si}`} className={`flex items-center gap-2 rounded px-3 py-1 text-xs ml-2 transition ${
                                isSubHighlighted ? "bg-yellow-300 scale-105" : "bg-purple-50"
                              }`}>
                                <span className="text-lg">{NFC_ICONS[sub.dir]}</span>
                                <span className="text-gray-600">{sub.dir}</span>
                                {sub.repeat > 1 && <span className="font-bold text-pink-600">×{sub.repeat}</span>}
                                {!progRunning && (
                                  <button
                                    onClick={() => {
                                      const groups = groupProgramForDisplay(program);
                                      const g = groups[gi];
                                      if (g.pBlock) {
                                        g.pBlock.ifSteps.splice(si, 1);
                                        setProgram(displayStepsToFlat(groups));
                                      }
                                    }}
                                    aria-label="削除"
                                    className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-500 active:bg-red-200 text-base font-bold transition"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                              );
                            })
                          ) : (
                            <div className="text-[10px] text-gray-400 ml-2 py-1">
                              {pBlockEditing === "if" ? "← カードをスキャン" : "—"}
                            </div>
                          )}

                          {/* else block */}
                          <div
                            onClick={() => {
                              if (progRunning) return;
                              if (!program.includes("PIPE")) {
                                setProgram((prev) => [...prev, "PIPE"]);
                              }
                              setPBlockEditing("else");
                            }}
                            className={`rounded px-2 py-1 text-xs font-bold ${
                              elseActive ? "bg-yellow-200 ring-2 ring-yellow-400"
                              : pBlockEditing === "else" ? "bg-purple-100 ring-2 ring-purple-400" : "bg-gray-50 hover:bg-purple-50"
                            } ${!progRunning ? "cursor-pointer" : ""}`}
                          >
                            <span className="text-purple-600">{t("elseBlock")} ({NFC_ICONS[group.pBlock!.elseLabel]} {group.pBlock!.elseLabel})</span>
                          </div>
                          {group.pBlock!.elseSteps.length > 0 ? (
                            group.pBlock!.elseSteps.map((sub, si) => {
                              const isSubHighlighted = sub.rawIndices.includes(progIndex);
                              return (
                              <div key={`else-${si}`} className={`flex items-center gap-2 rounded px-3 py-1 text-xs ml-2 transition ${
                                isSubHighlighted ? "bg-yellow-300 scale-105" : "bg-purple-50"
                              }`}>
                                <span className="text-lg">{NFC_ICONS[sub.dir]}</span>
                                <span className="text-gray-600">{sub.dir}</span>
                                {sub.repeat > 1 && <span className="font-bold text-pink-600">×{sub.repeat}</span>}
                                {!progRunning && (
                                  <button
                                    onClick={() => {
                                      const groups = groupProgramForDisplay(program);
                                      const g = groups[gi];
                                      if (g.pBlock) {
                                        g.pBlock.elseSteps.splice(si, 1);
                                        setProgram(displayStepsToFlat(groups));
                                      }
                                    }}
                                    aria-label="削除"
                                    className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-500 active:bg-red-200 text-base font-bold transition"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                              );
                            })
                          ) : (
                            <div className="text-[10px] text-gray-400 ml-2 py-1">
                              {pBlockEditing === "else" ? "← カードをスキャン" : "—"}
                            </div>
                          )}

                          {/* P-block control buttons */}
                          {!progRunning && pBlockEditing !== "none" && (
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={() => {
                                  setProgram((prev) => {
                                    const result = [...prev];
                                    if (!result.includes("PIPE")) result.push("PIPE");
                                    if (!result.includes("SLASH")) result.push("SLASH");
                                    return result;
                                  });
                                  setPBlockEditing("none");
                                }}
                                className="flex-1 rounded px-2 py-1 text-[10px] font-bold bg-gray-200 text-gray-600 hover:bg-gray-300 transition"
                              >
                                {t("closePBlock")}
                              </button>
                            </div>
                          )}
                        </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>

            {/* Run button */}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runProgram()}
              disabled={progRunning || program.length === 0}
              className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${
                progRunning
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {progRunning ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  {t("running")}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <polygon points="6 4 20 12 6 20 6 4" />
                  </svg>
                  {t("run")}
                  <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono text-white/60">Enter</kbd>
                </>
              )}
            </button>

          </div>
        )}
      </div>

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
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
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
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
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

      {/* Settings panel — right */}
      <div className="absolute top-4 right-4 z-10">
        {/* Panel header */}
        {!showSettings ? (
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg bg-white/95 p-2 shadow-md backdrop-blur border border-gray-200 transition hover:bg-white text-black/40 hover:text-black/70"
            title={t("settings")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        ) : (
          <div className="w-52 flex items-center bg-white/95 rounded-lg shadow-md backdrop-blur border border-gray-200 overflow-hidden">
            <span className="flex-1 px-3 py-2 text-sm font-bold text-gray-700">{t("settings")}</span>
            <button
              onClick={() => setShowSettings(false)}
              className="px-3 py-2 transition border-l border-gray-200 bg-gray-200 hover:bg-gray-300 text-black/70"
              title={t("close")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Panel body */}
        {showSettings && (
          <div className="mt-1 w-52 flex flex-col gap-2">
            <button
              onClick={() => setIs2D((v) => !v)}
              className="rounded-lg bg-white/95 px-4 py-2 text-sm font-medium text-black shadow-md backdrop-blur border border-gray-200 transition hover:bg-white"
            >
              {is2D ? t("mode3D") : t("mode2D")}
            </button>

            <div className="rounded-lg bg-white/95 p-3 shadow-md backdrop-blur border border-gray-200 flex flex-col gap-2">
              <div className="flex gap-1">
                {([["checker", 0], ["stripe", 1]] as const).map(([key, i]) => (
                  <button
                    key={key}
                    onClick={() => setPatternConfig((c) => ({ ...c, pattern: i }))}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                      i === patternConfig.pattern
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black/70 hover:bg-gray-200"
                    }`}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>

              {[["color1", patternConfig.color1] as const, ["color2", patternConfig.color2] as const].map(([key, value]) => (
                <div key={key}>
                  <label className="text-xs text-black/60">{t(key)}</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setPatternConfig((prev) => ({ ...prev, [key]: c }))}
                        className={`w-6 h-6 rounded-md border-2 transition ${
                          value === c ? "border-black scale-110" : "border-transparent hover:border-gray-400"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <label className="text-xs text-black/60 w-10">{t("width")}</label>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={patternConfig.scale}
                  onChange={(e) => setPatternConfig((c) => ({ ...c, scale: Number(e.target.value) }))}
                  className="flex-1"
                />
                <span className="text-xs text-black/60 w-6 text-right">{patternConfig.scale}</span>
              </div>
            </div>

            <a
              href="/help"
              className="rounded-lg bg-white/95 px-4 py-2 text-sm font-medium text-black shadow-md backdrop-blur border border-gray-200 transition hover:bg-white text-center"
            >
              {t("help")}
            </a>
          </div>
        )}
      </div>

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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* NTAG write modal */}
      {showNtagModal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full flex flex-col items-center gap-4">
            {ntagResult === "success" ? (
              <>
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-green-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-lg font-bold text-gray-800">{t("writeSuccess")}</p>
              </>
            ) : ntagResult === "error" ? (
              <>
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-red-600">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <p className="text-lg font-bold text-gray-800">{t("writeFailed")}</p>
                <button
                  onClick={handleCancelWrite}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                >
                  {t("close")}
                </button>
              </>
            ) : ntagWriting ? (
              <>
                {/* Sonar animation */}
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30" />
                  <div className="absolute inset-2 rounded-full border-2 border-blue-400 animate-ping opacity-40" style={{ animationDelay: "0.3s" }} />
                  <div className="absolute inset-4 rounded-full border-2 border-blue-400 animate-ping opacity-50" style={{ animationDelay: "0.6s" }} />
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-blue-600">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <path d="M12 12h.01" />
                      <path d="M17 12h.01" />
                      <path d="M7 12h.01" />
                    </svg>
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-600">{t("waitingForNtag")}</p>
                <button
                  onClick={handleCancelWrite}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition"
                >
                  {t("cancel")}
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-blue-500">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                </div>
                <p className="text-lg font-bold text-gray-800">{t("saveToNtag")}</p>
                <p className="text-sm text-gray-500 text-center whitespace-pre-line">{t("saveToNtagDesc")}</p>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => setShowNtagModal(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={handleStartNtagWrite}
                    className="flex-1 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                  >
                    {t("saveToNtag")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
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
