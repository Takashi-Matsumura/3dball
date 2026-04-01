"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { HintRule } from "@/lib/guide-content";
import { HELP_CONTENTS } from "@/lib/useGuide";

export type GuideFontSize = "small" | "medium" | "large";

const fontSizeClasses: Record<GuideFontSize, { hint: string; body: string; label: string; step: string; number: string; shortcut: string; title: string }> = {
  small: { hint: "text-sm", body: "text-sm", label: "text-xs", step: "text-sm", number: "w-5 h-5 text-xs", shortcut: "text-xs", title: "text-lg" },
  medium: { hint: "text-base", body: "text-base", label: "text-sm", step: "text-base", number: "w-6 h-6 text-sm", shortcut: "text-sm", title: "text-xl" },
  large: { hint: "text-lg", body: "text-lg", label: "text-base", step: "text-lg", number: "w-7 h-7 text-base", shortcut: "text-base", title: "text-2xl" },
};

// ── HintBubble ──

const anchorPositions: Record<string, string> = {
  "bottom-center": "bottom-14 left-1/2 -translate-x-1/2",
  "bottom-left": "bottom-14 left-4",
  "left-center": "top-1/2 left-72 -translate-y-1/2",
  "top-center": "top-16 left-1/2 -translate-x-1/2",
};

export function HintBubble({
  hint,
  onDismiss,
  fontSize = "small",
}: {
  hint: HintRule;
  onDismiss: () => void;
  fontSize?: GuideFontSize;
}) {
  const { td } = useI18n();
  const [visible, setVisible] = useState(false);
  const fs = fontSizeClasses[fontSize];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const pos = anchorPositions[hint.anchor] || anchorPositions["bottom-center"];
  const maxW = fontSize === "large" ? "max-w-[280px]" : fontSize === "medium" ? "max-w-[250px]" : "max-w-[220px]";

  return (
    <div
      className={`absolute ${pos} z-[15] ${maxW} transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <div className={`relative bg-white/95 backdrop-blur rounded-xl shadow-lg px-3 py-2 ${fs.hint} text-gray-800 leading-snug`}>
        <button
          onClick={onDismiss}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-300 hover:bg-gray-400 text-white text-xs flex items-center justify-center leading-none"
        >
          ×
        </button>
        {td(hint.textKey)}
      </div>
    </div>
  );
}

// ── HelpButton ──

export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 text-white/80 hover:text-white text-xs font-bold flex items-center justify-center transition"
      title="Guide (H)"
    >
      ?
    </button>
  );
}

// ── HelpPanel ──

const SHORTCUT_KEYS = [
  "shortcutArrows",
  "shortcutSpace",
  "shortcutP",
  "shortcutD",
  "shortcutF",
  "shortcutH",
  "shortcutLang",
] as const;

export function HelpPanel({
  contentKey,
  onClose,
  fontSize = "small",
}: {
  contentKey: string;
  onClose: () => void;
  fontSize?: GuideFontSize;
}) {
  const { td } = useI18n();
  const content = HELP_CONTENTS[contentKey] || HELP_CONTENTS.playground;
  const [visible, setVisible] = useState(false);
  const fs = fontSizeClasses[fontSize];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl mx-4 max-w-md w-full max-h-[80vh] overflow-y-auto transition-transform duration-200 ${
          visible ? "scale-100" : "scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className={`${fs.title} font-bold text-gray-800`}>
            {td(content.titleKey)}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Mission */}
          <section>
            <div className={`${fs.label} font-semibold text-blue-500 uppercase tracking-wide mb-1`}>
              {td("helpMission")}
            </div>
            <p className={`${fs.body} text-gray-700`}>{td(content.objectiveKey)}</p>
          </section>

          {/* Steps */}
          <section>
            <div className={`${fs.label} font-semibold text-blue-500 uppercase tracking-wide mb-1`}>
              {td("helpSteps")}
            </div>
            <ol className="space-y-1.5">
              {content.steps.map((step, i) => (
                <li
                  key={i}
                  className={`flex gap-2 ${fs.step} text-gray-700`}
                >
                  <span className={`flex-shrink-0 ${fs.number} rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center`}>
                    {i + 1}
                  </span>
                  <span>{td(step.textKey)}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Concept */}
          <section>
            <div className={`${fs.label} font-semibold text-green-600 uppercase tracking-wide mb-1`}>
              {td("helpConcept")}
            </div>
            <p className={`${fs.body} text-gray-700 bg-green-50 rounded-lg px-3 py-2`}>
              {td(content.conceptKey)}
            </p>
          </section>

          {/* Shortcuts */}
          <section>
            <div className={`${fs.label} font-semibold text-gray-400 uppercase tracking-wide mb-1`}>
              {td("helpShortcuts")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SHORTCUT_KEYS.map((k) => (
                <span
                  key={k}
                  className={`${fs.shortcut} bg-gray-100 text-gray-600 rounded px-2 py-0.5`}
                >
                  {td(k)}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
