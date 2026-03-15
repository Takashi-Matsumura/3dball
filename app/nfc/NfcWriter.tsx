"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface CardDef {
  id: string;
  labelKey: "dirUp" | "dirDown" | "dirLeft" | "dirRight";
  icon: string;
  bgColor: string;
  borderColor: string;
  hoverColor: string;
  textColor: string;
}

const DIRECTION_CARDS: CardDef[] = [
  { id: "UP",    labelKey: "dirUp",    icon: "⬆", bgColor: "bg-blue-100",   borderColor: "border-blue-400",   hoverColor: "hover:bg-blue-200",   textColor: "text-blue-700" },
  { id: "DOWN",  labelKey: "dirDown",  icon: "⬇", bgColor: "bg-orange-100", borderColor: "border-orange-400", hoverColor: "hover:bg-orange-200", textColor: "text-orange-700" },
  { id: "LEFT",  labelKey: "dirLeft",  icon: "⬅", bgColor: "bg-purple-100", borderColor: "border-purple-400", hoverColor: "hover:bg-purple-200", textColor: "text-purple-700" },
  { id: "RIGHT", labelKey: "dirRight", icon: "➡", bgColor: "bg-green-100",  borderColor: "border-green-400",  hoverColor: "hover:bg-green-200",  textColor: "text-green-700" },
];

type RegisterStatus = "idle" | "waiting" | "success" | "error";

interface RegisteredCard {
  uid: string;
  cardId: string;
}

export default function NfcWriter() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<CardDef | null>(null);
  const [status, setStatus] = useState<RegisterStatus>("idle");
  const [message, setMessage] = useState("");
  const [readerConnected, setReaderConnected] = useState(false);
  const [readerName, setReaderName] = useState("");
  const [registeredCards, setRegisteredCards] = useState<RegisteredCard[]>([]);
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

  const handleSelect = useCallback((card: CardDef) => {
    setSelected(card);
    setStatus("idle");
    setMessage("");
  }, []);

  const handleRegister = useCallback(async () => {
    if (!selected) return;

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      setStatus("waiting");
      setMessage(t("waitingForCard"));

      const res = await fetch("/api/nfc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: selected.id }),
        signal: ac.signal,
      });

      const data = await res.json();

      if (data.success) {
        setStatus("success");
        setMessage(`${t(selected.labelKey)} ${t("registered")} (UID: ${data.uid})`);
      } else {
        setStatus("error");
        setMessage(data.error || t("registerFailed"));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("error");
      setMessage(`${t("commError")}${err instanceof Error ? err.message : String(err)}`);
    }
  }, [selected, t]);

  const handleCancel = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    try {
      await fetch("/api/nfc", { method: "DELETE" });
    } catch {
      // ignore
    }
    setStatus("idle");
    setMessage("");
  }, []);

  const cardLabel = useCallback((cardId: string) => {
    const card = DIRECTION_CARDS.find((c) => c.id === cardId);
    return card ? `${card.icon} ${t(card.labelKey)}` : cardId;
  }, [t]);

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700"
          >
            {t("goBack")}
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">
            {t("nfcCardSetup")}
          </h1>
        </div>

        {/* Reader status */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-6 text-sm font-medium
          ${readerConnected
            ? "bg-green-50 border border-green-300 text-green-700"
            : "bg-red-50 border border-red-300 text-red-700"
          }`}
        >
          <span className={`inline-block w-3 h-3 rounded-full ${readerConnected ? "bg-green-500 animate-pulse" : "bg-red-400"}`} />
          {readerConnected
            ? `${t("readerConnected")}${readerName}`
            : t("readerNotFound")
          }
        </div>

        {/* Registered cards */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-700 mb-4">
            {t("registeredCards")}
          </h2>
          {registeredCards.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {registeredCards.map((rc) => (
                <div
                  key={rc.uid}
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-lg">{cardLabel(rc.cardId)}</span>
                  <span className="ml-auto text-xs text-gray-400 font-mono">{rc.uid}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">
              {t("noCardsYet")}
            </p>
          )}
        </div>

        {/* Card registration */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-700 mb-4">
            {t("selectDirAndTap")}
          </h2>

          <div className="flex flex-wrap gap-4 justify-center">
            {DIRECTION_CARDS.map((card) => (
              <button
                key={card.id}
                onClick={() => handleSelect(card)}
                disabled={status === "waiting"}
                className={`flex flex-col items-center justify-center w-28 h-28 rounded-xl border-2 transition-all font-bold text-sm
                  ${card.bgColor} ${card.borderColor} ${card.hoverColor}
                  ${selected?.id === card.id ? "ring-4 ring-blue-300 scale-105" : ""}
                  disabled:opacity-60 disabled:cursor-not-allowed
                `}
              >
                <span className="text-3xl mb-1">{card.icon}</span>
                <span className={card.textColor}>{t(card.labelKey)}</span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex flex-col items-center gap-4 mt-6 pt-6 border-t border-gray-100">
              <div className="flex gap-3">
                <button
                  onClick={handleRegister}
                  disabled={status === "waiting" || !readerConnected}
                  className={`px-8 py-3 rounded-xl font-bold text-lg transition-all
                    ${status === "waiting"
                      ? "bg-yellow-400 text-yellow-900 animate-pulse"
                      : "bg-blue-500 text-white hover:bg-blue-600 active:scale-95"
                    }
                    disabled:opacity-60 disabled:cursor-not-allowed
                  `}
                >
                  {status === "waiting" ? t("waitingCard") : `${t(selected.labelKey)} — ${t("registerBtn")}`}
                </button>

                {status === "waiting" && (
                  <button
                    onClick={handleCancel}
                    className="px-4 py-3 rounded-xl font-bold text-sm bg-gray-200 text-gray-600 hover:bg-gray-300 transition-all"
                  >
                    {t("cancel")}
                  </button>
                )}
              </div>

              {message && (
                <div
                  className={`px-4 py-3 rounded-lg text-sm font-medium w-full text-center
                    ${status === "success" ? "bg-green-100 text-green-700 border border-green-300" : ""}
                    ${status === "error" ? "bg-red-100 text-red-700 border border-red-300" : ""}
                    ${status === "waiting" ? "bg-yellow-50 text-yellow-700 border border-yellow-300" : ""}
                  `}
                >
                  {message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
