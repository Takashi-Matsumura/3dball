"use client";

import { useI18n } from "@/lib/i18n";
import { IconCheck, IconX, IconSave, IconCardReader } from "./icons";

interface NtagWriteModalProps {
  writing: boolean;
  result: "success" | "error" | null;
  onStart: () => void;
  onCancel: () => void;
  onClose: () => void;
}

export function NtagWriteModal({ writing, result, onStart, onCancel, onClose }: NtagWriteModalProps) {
  const { t } = useI18n();

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full flex flex-col items-center gap-4">
        {result === "success" ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <IconCheck className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-lg font-bold text-gray-800">{t("writeSuccess")}</p>
          </>
        ) : result === "error" ? (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <IconX className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-lg font-bold text-gray-800">{t("writeFailed")}</p>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
            >
              {t("close")}
            </button>
          </>
        ) : writing ? (
          <>
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30" />
              <div className="absolute inset-2 rounded-full border-2 border-blue-400 animate-ping opacity-40" style={{ animationDelay: "0.3s" }} />
              <div className="absolute inset-4 rounded-full border-2 border-blue-400 animate-ping opacity-50" style={{ animationDelay: "0.6s" }} />
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <IconCardReader className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600">{t("waitingForNtag")}</p>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition"
            >
              {t("cancel")}
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
              <IconSave className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-lg font-bold text-gray-800">{t("saveToNtag")}</p>
            <p className="text-sm text-gray-500 text-center whitespace-pre-line">{t("saveToNtagDesc")}</p>
            <div className="flex gap-2 w-full">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                {t("cancel")}
              </button>
              <button
                onClick={onStart}
                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
              >
                {t("saveToNtag")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
