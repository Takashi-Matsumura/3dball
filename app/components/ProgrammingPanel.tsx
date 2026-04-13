"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { NFC_ICONS } from "@/lib/ball-shared";
import {
  DisplayStep,
  PBlock,
  groupProgramForDisplay,
  displayStepsToFlat,
} from "@/lib/program";
import { IconCode, IconX, IconRefresh, IconSpinner, IconPlay } from "./icons";

type PBlockEditing = "none" | "if" | "else";

interface ProgrammingPanelProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onNew: () => void;
  onRun: () => void;
  running: boolean;
  nfcConnected: boolean;
  levelActive: boolean;

  program: string[];
  setProgram: React.Dispatch<React.SetStateAction<string[]>>;
  displaySteps: DisplayStep[];
  progIndex: number;
  pBlockEditing: PBlockEditing;
  setPBlockEditing: (v: PBlockEditing) => void;
}

export function ProgrammingPanel({
  open,
  onOpen,
  onClose,
  onNew,
  onRun,
  running,
  nfcConnected,
  levelActive,
  program,
  setProgram,
  displaySteps,
  progIndex,
  pBlockEditing,
  setPBlockEditing,
}: ProgrammingPanelProps) {
  const { t } = useI18n();
  const stepsRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const prevProgLenRef = useRef(0);

  // Auto-scroll the highlighted step into view during execution
  useEffect(() => {
    if (progIndex < 0 || !stepsRef.current) return;
    const gi = displaySteps.findIndex((g) => g.rawIndices.includes(progIndex));
    if (gi < 0) return;
    const el = stepsRef.current.children[gi] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [progIndex, displaySteps]);

  // Auto-scroll to the newest card when program grows (not during execution)
  useEffect(() => {
    if (running) {
      prevProgLenRef.current = program.length;
      return;
    }
    if (program.length > prevProgLenRef.current && stepsRef.current) {
      stepsRef.current.scrollTo({ top: stepsRef.current.scrollHeight, behavior: "smooth" });
    }
    prevProgLenRef.current = program.length;
  }, [program.length, running]);

  return (
    <div className={`absolute top-4 left-4 ${open ? "z-20 bottom-12 flex flex-col" : "z-10"}`}>
      {!open ? (levelActive && (
        <button
          onClick={() => nfcConnected && onOpen()}
          className={`rounded-lg bg-white/95 p-2 shadow-md backdrop-blur border border-gray-200 transition ${nfcConnected ? "hover:bg-white text-black/40 hover:text-black/70" : "text-black/15 cursor-not-allowed"}`}
          title={t("programming")}
          disabled={!nfcConnected}
        >
          <IconCode className="w-5 h-5" />
        </button>
      )) : (
        <div className="w-64 flex items-center bg-white/95 rounded-lg shadow-md backdrop-blur border border-gray-200 overflow-hidden">
          <button
            onClick={onClose}
            className="px-3 py-2 transition border-r border-gray-200 bg-gray-200 hover:bg-gray-300 text-black/70"
            title={t("close")}
          >
            <IconX className="w-4 h-4" />
          </button>
          <span className="flex-1 px-3 py-2 text-sm font-bold text-gray-700">{t("programming")}</span>
        </div>
      )}

      {open && (
        <div className="w-64 mt-1 flex flex-col flex-1 min-h-0 bg-white/95 rounded-lg shadow-md backdrop-blur border border-gray-200 overflow-hidden">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onNew}
            disabled={running}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gray-600 hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconRefresh className="w-4 h-4" />
            New
            <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono text-white/60">Space</kbd>
          </button>

          <div ref={stepsRef} className="flex-1 overflow-y-auto min-h-[120px] px-2 py-2 flex flex-col gap-1">
            {displaySteps.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8 whitespace-pre-line">
                {t("scanCardToAdd")}
              </p>
            ) : (
              displaySteps.map((group, gi) => {
                const isHighlighted = progIndex != null && group.rawIndices.includes(progIndex);
                return (
                  <div key={gi}>
                    <ProgramStepRow
                      group={group}
                      gi={gi}
                      running={running}
                      highlighted={isHighlighted}
                      dragIndex={dragIndex}
                      dragOverIndex={dragOverIndex}
                      onDragStart={() => setDragIndex(gi)}
                      onDragOver={() => setDragOverIndex(gi)}
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
                      onDelete={() => {
                        const groups = groupProgramForDisplay(program);
                        groups.splice(gi, 1);
                        setProgram(displayStepsToFlat(groups));
                        setPBlockEditing("none");
                      }}
                    />

                    {group.pBlock && (
                      <PBlockEditor
                        pBlock={group.pBlock}
                        gi={gi}
                        running={running}
                        progIndex={progIndex}
                        pBlockEditing={pBlockEditing}
                        setPBlockEditing={setPBlockEditing}
                        program={program}
                        setProgram={setProgram}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onRun}
            disabled={running || program.length === 0}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${
              running ? "bg-yellow-500 animate-pulse" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {running ? (
              <>
                <IconSpinner className="w-4 h-4 animate-spin" />
                {t("running")}
              </>
            ) : (
              <>
                <IconPlay className="w-4 h-4" />
                {t("run")}
                <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono text-white/60">Enter</kbd>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

const DELETE_BTN_CLS =
  "ml-auto flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-500 active:bg-red-200 text-lg font-bold transition";
const SUB_DELETE_BTN_CLS =
  "ml-auto flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-500 active:bg-red-200 text-base font-bold transition";

interface ProgramStepRowProps {
  group: DisplayStep;
  gi: number;
  running: boolean;
  highlighted: boolean;
  dragIndex: number | null;
  dragOverIndex: number | null;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  onDelete: () => void;
}

function ProgramStepRow({
  group,
  gi,
  running,
  highlighted,
  dragIndex,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDelete,
}: ProgramStepRowProps) {
  const draggable = !running && !group.pBlock;
  const rowCls = highlighted
    ? "bg-yellow-300 scale-105"
    : dragOverIndex === gi && dragIndex !== null && dragIndex !== gi
      ? "bg-blue-100 border-t-2 border-blue-400"
      : dragIndex === gi
        ? "bg-gray-200 opacity-50"
        : "bg-gray-100";

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${rowCls}`}
      style={{ cursor: running ? "default" : group.pBlock ? "default" : "grab" }}
    >
      {draggable && (
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
      {!running && (
        <button onClick={onDelete} aria-label="削除" className={DELETE_BTN_CLS}>
          ✕
        </button>
      )}
    </div>
  );
}

interface PBlockEditorProps {
  pBlock: PBlock;
  gi: number;
  running: boolean;
  progIndex: number;
  pBlockEditing: PBlockEditing;
  setPBlockEditing: (v: PBlockEditing) => void;
  program: string[];
  setProgram: React.Dispatch<React.SetStateAction<string[]>>;
}

function PBlockEditor({
  pBlock,
  gi,
  running,
  progIndex,
  pBlockEditing,
  setPBlockEditing,
  program,
  setProgram,
}: PBlockEditorProps) {
  const { t } = useI18n();

  const ifActive = progIndex != null && pBlock.ifSteps.some((sub) => sub.rawIndices.includes(progIndex));
  const elseActive = progIndex != null && pBlock.elseSteps.some((sub) => sub.rawIndices.includes(progIndex));

  const deleteSubStep = (branch: "if" | "else", si: number) => {
    const groups = groupProgramForDisplay(program);
    const g = groups[gi];
    if (!g.pBlock) return;
    (branch === "if" ? g.pBlock.ifSteps : g.pBlock.elseSteps).splice(si, 1);
    setProgram(displayStepsToFlat(groups));
  };

  const selectElse = () => {
    if (running) return;
    if (!program.includes("PIPE")) {
      setProgram((prev) => [...prev, "PIPE"]);
    }
    setPBlockEditing("else");
  };

  const closeBlock = () => {
    setProgram((prev) => {
      const result = [...prev];
      if (!result.includes("PIPE")) result.push("PIPE");
      if (!result.includes("SLASH")) result.push("SLASH");
      return result;
    });
    setPBlockEditing("none");
  };

  return (
    <div className="ml-4 mt-1 mb-1 border-l-2 border-purple-300 pl-2 flex flex-col gap-1">
      <BranchHeader
        label={t("ifBlock")}
        dir={pBlock.ifLabel}
        active={ifActive}
        editing={pBlockEditing === "if"}
        disabled={running}
        onSelect={() => !running && setPBlockEditing("if")}
      />
      <BranchSteps
        steps={pBlock.ifSteps}
        progIndex={progIndex}
        running={running}
        placeholder={pBlockEditing === "if" ? "← カードをスキャン" : "—"}
        onDelete={(si) => deleteSubStep("if", si)}
        keyPrefix="if"
      />

      <BranchHeader
        label={t("elseBlock")}
        dir={pBlock.elseLabel}
        active={elseActive}
        editing={pBlockEditing === "else"}
        disabled={running}
        onSelect={selectElse}
      />
      <BranchSteps
        steps={pBlock.elseSteps}
        progIndex={progIndex}
        running={running}
        placeholder={pBlockEditing === "else" ? "← カードをスキャン" : "—"}
        onDelete={(si) => deleteSubStep("else", si)}
        keyPrefix="else"
      />

      {!running && pBlockEditing !== "none" && (
        <div className="flex gap-1 mt-1">
          <button
            onClick={closeBlock}
            className="flex-1 rounded px-2 py-1 text-[10px] font-bold bg-gray-200 text-gray-600 hover:bg-gray-300 transition"
          >
            {t("closePBlock")}
          </button>
        </div>
      )}
    </div>
  );
}

function BranchHeader({
  label,
  dir,
  active,
  editing,
  disabled,
  onSelect,
}: {
  label: string;
  dir: string;
  active: boolean;
  editing: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const cls = active
    ? "bg-yellow-200 ring-2 ring-yellow-400"
    : editing
      ? "bg-purple-100 ring-2 ring-purple-400"
      : "bg-gray-50 hover:bg-purple-50";
  return (
    <div
      onClick={onSelect}
      className={`rounded px-2 py-1 text-xs font-bold ${cls} ${!disabled ? "cursor-pointer" : ""}`}
    >
      <span className="text-purple-600">{label} ({NFC_ICONS[dir]} {dir})</span>
    </div>
  );
}

function BranchSteps({
  steps,
  progIndex,
  running,
  placeholder,
  onDelete,
  keyPrefix,
}: {
  steps: DisplayStep[];
  progIndex: number;
  running: boolean;
  placeholder: string;
  onDelete: (si: number) => void;
  keyPrefix: string;
}) {
  if (steps.length === 0) {
    return <div className="text-[10px] text-gray-400 ml-2 py-1">{placeholder}</div>;
  }
  return (
    <>
      {steps.map((sub, si) => {
        const isSubHighlighted = progIndex != null && sub.rawIndices.includes(progIndex);
        return (
          <div
            key={`${keyPrefix}-${si}`}
            className={`flex items-center gap-2 rounded px-3 py-1 text-xs ml-2 transition ${
              isSubHighlighted ? "bg-yellow-300 scale-105" : "bg-purple-50"
            }`}
          >
            <span className="text-lg">{NFC_ICONS[sub.dir]}</span>
            <span className="text-gray-600">{sub.dir}</span>
            {sub.repeat > 1 && <span className="font-bold text-pink-600">×{sub.repeat}</span>}
            {!running && (
              <button onClick={() => onDelete(si)} aria-label="削除" className={SUB_DELETE_BTN_CLS}>
                ✕
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
