"use client";

import React, { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

// ── InfoOverlay (marquee subtitle) ──

const INFO_KEYS: Record<string, string> = {
  playground: "infoPlayground",
  lv1: "infoLv1",
  lv2: "infoLv2",
  lv3: "infoLv3",
};

export function InfoOverlay({
  levelId,
  onClose,
}: {
  levelId: string | null;
  onClose: () => void;
}) {
  const { td } = useI18n();
  const key = INFO_KEYS[levelId || "playground"] || INFO_KEYS.playground;
  const text = td(key);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 cursor-pointer ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div className="max-w-3xl px-8">
        <p
          className="text-white font-bold leading-relaxed text-center"
          style={{
            fontSize: "clamp(1.5rem, 4vw, 3rem)",
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

// ── InfoButton ──

export function InfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 text-white/80 hover:text-white text-xs font-bold flex items-center justify-center transition"
      title="Info (I)"
    >
      i
    </button>
  );
}
