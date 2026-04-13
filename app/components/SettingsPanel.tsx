"use client";

import { useI18n } from "@/lib/i18n";
import { COLOR_PRESETS, PatternConfig } from "@/lib/ball-shared";
import { IconSettings, IconX } from "./icons";

interface SettingsPanelProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  is2D: boolean;
  setIs2D: (fn: (prev: boolean) => boolean) => void;
  patternConfig: PatternConfig;
  setPatternConfig: (fn: (prev: PatternConfig) => PatternConfig) => void;
}

export function SettingsPanel({
  open,
  setOpen,
  is2D,
  setIs2D,
  patternConfig,
  setPatternConfig,
}: SettingsPanelProps) {
  const { t } = useI18n();

  return (
    <div className="absolute top-4 right-4 z-10">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-white/95 p-2 shadow-md backdrop-blur border border-gray-200 transition hover:bg-white text-black/40 hover:text-black/70"
          title={t("settings")}
        >
          <IconSettings className="w-5 h-5" />
        </button>
      ) : (
        <div className="w-52 flex items-center bg-white/95 rounded-lg shadow-md backdrop-blur border border-gray-200 overflow-hidden">
          <span className="flex-1 px-3 py-2 text-sm font-bold text-gray-700">{t("settings")}</span>
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-2 transition border-l border-gray-200 bg-gray-200 hover:bg-gray-300 text-black/70"
            title={t("close")}
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
      )}

      {open && (
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
  );
}
