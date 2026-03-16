"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface ActionDef {
  id: string;
  labelKey: "dirUp" | "dirDown" | "dirLeft" | "dirRight" | "dirJump";
  icon: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

const ACTIONS: ActionDef[] = [
  { id: "UP",    labelKey: "dirUp",    icon: "⬆", bgColor: "bg-blue-100",   borderColor: "border-blue-400",   textColor: "text-blue-700" },
  { id: "DOWN",  labelKey: "dirDown",  icon: "⬇", bgColor: "bg-orange-100", borderColor: "border-orange-400", textColor: "text-orange-700" },
  { id: "LEFT",  labelKey: "dirLeft",  icon: "⬅", bgColor: "bg-purple-100", borderColor: "border-purple-400", textColor: "text-purple-700" },
  { id: "RIGHT", labelKey: "dirRight", icon: "➡", bgColor: "bg-green-100",  borderColor: "border-green-400",  textColor: "text-green-700" },
  { id: "JUMP",  labelKey: "dirJump",  icon: "⤴", bgColor: "bg-yellow-100", borderColor: "border-yellow-400", textColor: "text-yellow-700" },
];

interface RegisteredCard {
  uid: string;
  cardId: string;
}

export default function NfcWriter() {
  const { t } = useI18n();
  const [readerConnected, setReaderConnected] = useState(false);
  const [readerName, setReaderName] = useState("");
  const [registeredCards, setRegisteredCards] = useState<RegisteredCard[]>([]);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Poll reader status + registered cards
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/nfc");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setReaderConnected(data.connected);
          setReaderName(data.readerName || "");
          setRegisteredCards(data.cards || []);
        }
      } catch {
        // ignore
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const getCardUid = useCallback(
    (actionId: string) => registeredCards.find((c) => c.cardId === actionId)?.uid,
    [registeredCards],
  );

  const handleRegister = useCallback(async (action: ActionDef) => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setRegisteringId(action.id);
    setResultMessage(null);

    try {
      const res = await fetch("/api/nfc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: action.id }),
        signal: ac.signal,
      });
      const data = await res.json();
      if (data.success) {
        setResultMessage({ type: "success", text: `${t(action.labelKey)} — UID: ${data.uid}` });
      } else {
        setResultMessage({ type: "error", text: data.error || t("registerFailed") });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setResultMessage({ type: "error", text: `${t("commError")}${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setRegisteringId(null);
    }
  }, [t]);

  const handleCancel = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    try { await fetch("/api/nfc", { method: "DELETE" }); } catch { /* ignore */ }
    setRegisteringId(null);
    setResultMessage(null);
  }, []);

  const allRegistered = ACTIONS.every((a) => getCardUid(a.id));

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700"
          >
            {t("goBack")}
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">{t("nfcCardSetup")}</h1>
        </div>

        {/* Reader status */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-6 text-sm font-medium
          ${readerConnected
            ? "bg-green-50 border border-green-300 text-green-700"
            : "bg-red-50 border border-red-300 text-red-700"
          }`}
        >
          <span className={`inline-block w-3 h-3 rounded-full ${readerConnected ? "bg-green-500 animate-pulse" : "bg-red-400"}`} />
          {readerConnected ? `${t("readerConnected")}${readerName}` : t("readerNotFound")}
        </div>

        {/* Result message */}
        {resultMessage && (
          <div className={`px-4 py-3 rounded-xl mb-6 text-sm font-medium text-center
            ${resultMessage.type === "success" ? "bg-green-100 text-green-700 border border-green-300" : "bg-red-100 text-red-700 border border-red-300"}
          `}>
            {resultMessage.text}
          </div>
        )}

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300 rounded-full"
              style={{ width: `${(ACTIONS.filter((a) => getCardUid(a.id)).length / ACTIONS.length) * 100}%` }}
            />
          </div>
          <span className="text-sm text-gray-500 font-medium">
            {ACTIONS.filter((a) => getCardUid(a.id)).length} / {ACTIONS.length}
          </span>
        </div>

        {/* Action cards */}
        <div className="flex flex-col gap-3">
          {ACTIONS.map((action) => {
            const uid = getCardUid(action.id);
            const isRegistering = registeringId === action.id;

            return (
              <div
                key={action.id}
                className={`flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all ${
                  uid ? `${action.bgColor} ${action.borderColor}` : "bg-white border-gray-200"
                } ${isRegistering ? "ring-4 ring-yellow-300 animate-pulse" : ""}`}
              >
                {/* Icon */}
                <span className="text-3xl w-10 text-center">{action.icon}</span>

                {/* Label + UID */}
                <div className="flex-1 min-w-0">
                  <span className={`font-bold ${uid ? action.textColor : "text-gray-400"}`}>
                    {t(action.labelKey)}
                  </span>
                  {uid && (
                    <span className="ml-3 text-xs text-gray-400 font-mono">{uid}</span>
                  )}
                </div>

                {/* Action button */}
                {isRegistering ? (
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-600 hover:bg-gray-300 transition shrink-0"
                  >
                    {t("cancel")}
                  </button>
                ) : (
                  <button
                    onClick={() => handleRegister(action)}
                    disabled={!readerConnected || registeringId !== null}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                      uid
                        ? "bg-white/80 text-gray-600 hover:bg-white border border-gray-300"
                        : "bg-blue-500 text-white hover:bg-blue-600"
                    }`}
                  >
                    {uid ? t("reRegister") : t("tapToRegister")}
                  </button>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
