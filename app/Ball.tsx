"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { useI18n, Locale } from "@/lib/i18n";
import {
  CELL_SIZE,
  COLOR_PRESETS,
  PatternConfig,
  NFC_DIRECTIONS,
  NFC_ICONS,
  moveGrid,
  encodeProgram,
  generateRandomPath,
} from "@/lib/ball-shared";
import { CameraController, Board, Ground, Sphere, CellMarker, TextSprite } from "@/app/components/Scene";
import { playMove, playJump, playBump, playNfcScan, playSuccess } from "@/lib/sounds";

export default function Ball() {
  const { locale, setLocale, t } = useI18n();
  const [gridPos, setGridPos] = useState({ col: 1, row: 1 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [is2D, setIs2D] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [patternConfig, setPatternConfig] = useState<PatternConfig>({
    pattern: 0,
    color1: "#4488ff",
    color2: "#ffffff",
    scale: 20,
  });
  const [jumping, setJumping] = useState(false);
  const [nfcConnected, setNfcConnected] = useState(false);
  const [nfcFlash, setNfcFlash] = useState<string | null>(null);
  const isAnimatingRef = useRef(false);

  // Programming mode
  const [progMode, setProgMode] = useState(false);
  const [program, setProgram] = useState<string[]>([]);
  const [progRunning, setProgRunning] = useState(false);
  const [progIndex, setProgIndex] = useState(-1);
  const progModeRef = useRef(false);
  const progStepsRef = useRef<HTMLDivElement>(null);
  const progRunningRef = useRef(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Lv1 mode
  const [lv1Mode, setLv1Mode] = useState(false);
  const [lv1Start, setLv1Start] = useState({ col: 0, row: 0 });
  const [lv1Goal, setLv1Goal] = useState({ col: 2, row: 2 });
  const [lv1Cleared, setLv1Cleared] = useState(false);
  const [lv1Challenge, setLv1Challenge] = useState<number | null>(null); // target move count
  const [lv1Moves, setLv1Moves] = useState(0);

  const generateLv1 = useCallback(() => {
    const positions: { col: number; row: number }[] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) positions.push({ col: c, row: r });
    const startIdx = Math.floor(Math.random() * positions.length);
    const start = positions[startIdx];
    // Goal must be at least 2 steps (Manhattan distance) away
    const far = positions.filter((p) =>
      Math.abs(p.col - start.col) + Math.abs(p.row - start.row) >= 2
    );
    const goal = far[Math.floor(Math.random() * far.length)];
    setLv1Start(start);
    setLv1Goal(goal);
    setGridPos(start);
    setLv1Cleared(false);
    setLv1Challenge(null);
    setLv1Moves(0);
    setIsAnimating(false);
  }, []);

  const generateChallenge = useCallback(() => {
    let count: number;
    let attempts = 0;
    do {
      const path = generateRandomPath(lv1Start, lv1Goal);
      count = path.length;
      attempts++;
    } while (count === lv1Challenge && attempts < 20);
    setLv1Challenge(count);
    setLv1Moves(0);
    setGridPos(lv1Start);
    setLv1Cleared(false);
    setIsAnimating(false);
  }, [lv1Start, lv1Goal, lv1Challenge]);

  // NTAG write
  const [showNtagModal, setShowNtagModal] = useState(false);
  const [ntagWriting, setNtagWriting] = useState(false);
  const [ntagResult, setNtagResult] = useState<"success" | "error" | null>(null);

  useEffect(() => { progModeRef.current = progMode; }, [progMode]);
  useEffect(() => { progRunningRef.current = progRunning; }, [progRunning]);

  // Auto-scroll to highlighted step
  useEffect(() => {
    if (progIndex < 0 || !progStepsRef.current) return;
    const el = progStepsRef.current.children[progIndex] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [progIndex]);

  // Keep ref in sync for NFC polling callback
  useEffect(() => { isAnimatingRef.current = isAnimating; }, [isAnimating]);

  // Lv1: count moves and detect goal
  const lv1PrevPos = useRef(gridPos);
  useEffect(() => {
    if (!lv1Mode || lv1Cleared) return;
    const prev = lv1PrevPos.current;
    if (prev.col !== gridPos.col || prev.row !== gridPos.row) {
      setLv1Moves((m) => m + 1);
    }
    lv1PrevPos.current = gridPos;
  }, [gridPos, lv1Mode, lv1Cleared]);

  // Lv1 goal detection — only in non-programming mode (direct move)
  // In programming mode, goal check is handled inside runProgram
  useEffect(() => {
    if (!lv1Mode || lv1Cleared || isAnimating || progMode) return;
    if (gridPos.col === lv1Goal.col && gridPos.row === lv1Goal.row) {
      setLv1Cleared(true);
      playSuccess();
    }
  }, [gridPos, isAnimating, lv1Mode, lv1Goal, lv1Cleared, progMode]);

  // Run program step by step
  const animDoneResolveRef = useRef<(() => void) | null>(null);
  const jumpDoneResolveRef = useRef<(() => void) | null>(null);

  const runProgram = useCallback(async () => {
    if (program.length === 0) return;
    setProgRunning(true);
    setLv1Cleared(false);
    setLv1Moves(0);
    lv1PrevPos.current = lv1Mode ? lv1Start : { col: 1, row: 1 };
    // Reset ball to start position (Lv1: start, normal: center)
    const startPos = lv1Mode ? lv1Start : { col: 1, row: 1 };
    setGridPos(startPos);
    setIsAnimating(false);
    // Wait a frame for reset
    await new Promise((r) => setTimeout(r, 100));

    let currentPos = { ...startPos };
    let passedGoal = false;
    for (let i = 0; i < program.length; i++) {
      setProgIndex(i);
      const direction = program[i];
      if (direction === "JUMP") {
        setJumping(true);
        playJump();
        await new Promise<void>((resolve) => {
          jumpDoneResolveRef.current = resolve;
        });
      } else {
        const next = moveGrid(currentPos, direction);
        if (next) {
          // Check if intermediate step passes through goal (not the last step)
          if (lv1Mode && i < program.length - 1 &&
              next.col === lv1Goal.col && next.row === lv1Goal.row) {
            passedGoal = true;
          }
          currentPos = next;
          playMove();
          setIsAnimating(true);
          setGridPos(next);
          // Wait for animation to complete
          await new Promise<void>((resolve) => {
            animDoneResolveRef.current = resolve;
          });
        }
      }
      // Small pause between steps
      await new Promise((r) => setTimeout(r, 200));
    }
    setProgIndex(-1);
    setProgRunning(false);

    // Lv1: clear only if ended on goal without passing through it
    if (lv1Mode && !passedGoal &&
        currentPos.col === lv1Goal.col && currentPos.row === lv1Goal.row) {
      setLv1Cleared(true);
      playSuccess();
    } else if (!lv1Mode) {
      playSuccess();
    }
  }, [program, lv1Mode, lv1Start, lv1Goal]);

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
    if (lv1Mode) {
      params.set("sc", String(lv1Start.col));
      params.set("sr", String(lv1Start.row));
      params.set("gc", String(lv1Goal.col));
      params.set("gr", String(lv1Goal.row));
      if (lv1Challenge !== null) params.set("ch", String(lv1Challenge));
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
        // Open replay locally for dev verification
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
  }, [program, patternConfig, lv1Mode, lv1Start, lv1Goal, lv1Challenge]);

  const handleCancelWrite = useCallback(() => {
    fetch("/api/nfc/write", { method: "DELETE" });
    setNtagWriting(false);
    setShowNtagModal(false);
  }, []);

  const handleAnimDone = useCallback(() => {
    setIsAnimating(false);
    if (animDoneResolveRef.current) {
      animDoneResolveRef.current();
      animDoneResolveRef.current = null;
    }
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

          // Programming mode: add to program instead of moving
          if (progModeRef.current && !progRunningRef.current) {
            setProgram((prev) => [...prev, cardId]);
            playNfcScan();
            setNfcFlash(cardId);
            setTimeout(() => { if (!cancelled) setNfcFlash(null); }, 500);
            continue;
          }

          // Normal mode: move ball directly
          if (progModeRef.current) continue; // skip during run
          if (isAnimatingRef.current) continue;

          if (cardId === "JUMP") {
            setJumping(true);
            playJump();
          } else {
            setGridPos((prev) => {
              const next = moveGrid(prev, cardId);
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

  const handleJumpDone = useCallback(() => {
    setJumping(false);
    if (jumpDoneResolveRef.current) {
      jumpDoneResolveRef.current();
      jumpDoneResolveRef.current = null;
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Tab → generate challenge when Lv1 active
      if (e.key === "Tab" && lv1Mode && !lv1Cleared) {
        e.preventDefault();
        generateChallenge();
        return;
      }
      // Enter → next challenge when Lv1 cleared
      if (e.key === "Enter" && lv1Cleared) {
        e.preventDefault();
        generateLv1();
        return;
      }
      if (progMode || isAnimating) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (!jumping) {
          setJumping(true);
          playJump();
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
        const next = moveGrid(prev, direction);
        if (!next) {
          playBump();
          return prev;
        }
        playMove();
        setIsAnimating(true);
        return next;
      });
    },
    [isAnimating, jumping, progMode, lv1Mode, lv1Cleared, generateLv1, generateChallenge]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="relative h-screen w-screen">
      {/* Programming panel — left */}
      <div className="absolute top-4 left-4 z-10">
        {/* Panel header */}
        {!progMode ? (
          <button
            onClick={() => setProgMode(true)}
            className="rounded-lg bg-white/95 p-2 shadow-md backdrop-blur border border-gray-200 transition hover:bg-white text-black/40 hover:text-black/70"
            title={t("programming")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
        ) : (
          <div className="w-52 flex items-center bg-white/95 rounded-lg shadow-md backdrop-blur border border-gray-200 overflow-hidden">
            <button
              onClick={() => {
                setProgMode(false);
                setProgram([]);
                setProgIndex(-1);
                setProgRunning(false);
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
          <div className="mt-1 flex flex-col bg-white/95 rounded-lg shadow-md backdrop-blur border border-gray-200 overflow-hidden" style={{ maxHeight: "calc(100vh - 8rem)" }}>
            {/* New button */}
            <button
              onClick={() => {
                setProgram([]);
                setProgIndex(-1);
                if (lv1Mode) {
                  generateLv1();
                } else {
                  setGridPos({ col: 1, row: 1 });
                }
              }}
              disabled={progRunning}
              className="px-4 py-2 text-sm font-bold text-white bg-gray-600 hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              New
            </button>

            {/* Program steps */}
            <div ref={progStepsRef} className="flex-1 overflow-y-auto min-h-[120px] px-2 py-2 flex flex-col gap-1">
              {program.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8 whitespace-pre-line">
                  {t("scanCardToAdd")}
                </p>
              ) : (
                program.map((dir, i) => (
                  <div
                    key={i}
                    draggable={!progRunning}
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                    onDragEnd={() => {
                      if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
                        setProgram((p) => {
                          const next = [...p];
                          const [item] = next.splice(dragIndex, 1);
                          next.splice(dragOverIndex, 0, item);
                          return next;
                        });
                      }
                      setDragIndex(null);
                      setDragOverIndex(null);
                    }}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      progIndex === i
                        ? "bg-yellow-300 scale-105"
                        : dragOverIndex === i && dragIndex !== null && dragIndex !== i
                          ? "bg-blue-100 border-t-2 border-blue-400"
                          : dragIndex === i
                            ? "bg-gray-200 opacity-50"
                            : "bg-gray-100"
                    }`}
                    style={{ cursor: progRunning ? "default" : "grab" }}
                  >
                    {!progRunning && (
                      <span className="text-gray-300 text-xs cursor-grab select-none">☰</span>
                    )}
                    <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                    <span className="text-lg">{NFC_ICONS[dir]}</span>
                    <span className="text-xs text-gray-600">{dir}</span>
                    {!progRunning && (
                      <button
                        onClick={() => setProgram((p) => p.filter((_, j) => j !== i))}
                        className="ml-auto text-gray-400 hover:text-red-500 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Run button */}
            <button
              onClick={runProgram}
              disabled={progRunning || program.length === 0}
              className={`px-4 py-2 text-sm font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${
                progRunning
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {progRunning ? t("running") : t("run")}
            </button>

          </div>
        )}
      </div>

      {/* Lv1 theme label — bottom center, above footer */}
      {lv1Mode && (!lv1Cleared || progMode) && (
        <div className="absolute bottom-12 left-0 right-0 z-10 flex flex-col items-center gap-1">
          {/* Move counter — shown when challenge is active */}
          {lv1Challenge !== null && (
            <div className="flex items-center gap-3 text-white/90 text-lg font-bold">
              <span>{lv1Moves}</span>
              <span className="text-white/40">/</span>
              <span className="text-yellow-300">{lv1Challenge}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="text-xl font-bold text-yellow-300 drop-shadow-md" style={{ textShadow: "0 0 10px rgba(255,200,0,0.6)" }}>
              {lv1Challenge !== null
                ? `${lv1Challenge}${t("lv1ChallengeTheme")}`
                : t("lv1Theme")}
            </div>
            <button
              onClick={generateChallenge}
              className="rounded px-2 py-0.5 text-xs font-bold bg-white/20 text-white/80 hover:bg-white/30 transition backdrop-blur"
            >
              {t("lv1Challenge")}
            </button>
          </div>
        </div>
      )}

      {/* Lv1 clear — next button at center (hide in prog mode — use Run instead) */}
      {lv1Cleared && !progMode && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <button
            onClick={() => generateLv1()}
            className="pointer-events-auto w-24 h-24 rounded-2xl bg-white/95 shadow-xl backdrop-blur border border-gray-200 transition hover:bg-white hover:scale-105 flex flex-col items-center justify-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-gray-700">
              <polyline points="9 10 4 15 9 20" />
              <path d="M20 4v7a4 4 0 0 1-4 4H4" />
            </svg>
            <span className="text-xs font-bold text-gray-500">{t("nextChallenge")}</span>
          </button>
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
              href="/nfc"
              className="rounded-lg bg-white/95 px-4 py-2 text-sm font-medium text-black shadow-md backdrop-blur border border-gray-200 transition hover:bg-white text-center"
            >
              {t("nfcCardRegister")}
            </a>

            <div className="rounded-lg bg-white/95 p-3 shadow-md backdrop-blur border border-gray-200 flex flex-col gap-1">
              <label className="text-xs text-black/60 mb-1">{t("language")}</label>
              <div className="flex gap-1">
                {(["ja", "en"] as Locale[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLocale(lang)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                      locale === lang
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black/70 hover:bg-gray-200"
                    }`}
                  >
                    {lang === "ja" ? "日本語" : "English"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer — NFC status + NTAG save */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center px-4 py-2 bg-black/50 backdrop-blur">
        <div className="flex-1 flex">
          {!progMode && (
            <button
              onClick={() => {
                if (lv1Mode) {
                  setLv1Mode(false);
                  setLv1Cleared(false);
                  setGridPos({ col: 1, row: 1 });
                } else {
                  setLv1Mode(true);
                  generateLv1();
                }
              }}
              className={`rounded px-2 py-0.5 text-xs font-bold transition ${
                lv1Mode
                  ? "bg-yellow-400 text-black"
                  : "bg-white/20 text-white/60 hover:bg-white/30"
              }`}
            >
              {t("lv1")}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-white/80">
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

      {/* NFC flash */}
      {nfcFlash && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="rounded-xl bg-white/90 px-4 py-3 shadow-xl backdrop-blur text-center animate-bounce">
            <div className="text-2xl">{NFC_ICONS[nfcFlash]}</div>
            <div className="text-xs font-bold text-gray-700">{nfcFlash}</div>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [0, 5, 5], fov: 45 }} gl={{ antialias: true }} shadows>
        <color attach="background" args={["#0d0d14"]} />
        <fog attach="fog" args={["#0d0d14", 8, 18]} />
        <CameraController is2D={is2D} />
        <ambientLight intensity={1.0} />
        <directionalLight
          position={[3, 6, 4]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
          shadow-bias={-0.002}
        />
        <pointLight position={[0, 3, 0]} intensity={0.3} color="#aaccff" />
        <Ground />
        <Board />
        {lv1Mode && (!lv1Cleared || progMode) && (
          <>
            <CellMarker col={lv1Start.col} row={lv1Start.row} color="#44cc44" />
            <TextSprite col={lv1Start.col} row={lv1Start.row} text={t("start")} color="#44cc44" />
            <CellMarker col={lv1Goal.col} row={lv1Goal.row} color="#ffaa00" />
            <TextSprite col={lv1Goal.col} row={lv1Goal.row} text={t("goal")} color="#ffaa00" />
          </>
        )}
        <Sphere
          gridCol={gridPos.col}
          gridRow={gridPos.row}
          jumping={jumping}
          onAnimDone={handleAnimDone}
          onJumpDone={handleJumpDone}
          patternConfig={patternConfig}
        />
      </Canvas>
    </div>
  );
}
