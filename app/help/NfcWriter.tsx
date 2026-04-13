"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { IconChevron, IconCheck } from "@/app/components/icons";

interface ActionDef {
  id: string;
  labelKey: "dirUp" | "dirDown" | "dirLeft" | "dirRight" | "dirJump" | "dirX2" | "dirX3" | "dirBranch";
  icon: string;
  accent: string;
  iconBg: string;
  category: "direction" | "modifier" | "branch";
}

const ACTIONS: ActionDef[] = [
  { id: "UP",     labelKey: "dirUp",     icon: "⬆",  accent: "text-blue-600",   iconBg: "bg-blue-50",   category: "direction" },
  { id: "DOWN",   labelKey: "dirDown",   icon: "⬇",  accent: "text-orange-600", iconBg: "bg-orange-50", category: "direction" },
  { id: "LEFT",   labelKey: "dirLeft",   icon: "⬅",  accent: "text-purple-600", iconBg: "bg-purple-50", category: "direction" },
  { id: "RIGHT",  labelKey: "dirRight",  icon: "➡",  accent: "text-green-600",  iconBg: "bg-green-50",  category: "direction" },
  { id: "JUMP",   labelKey: "dirJump",   icon: "⤴",  accent: "text-yellow-600", iconBg: "bg-yellow-50", category: "direction" },
  { id: "X2",     labelKey: "dirX2",     icon: "×2", accent: "text-pink-600",   iconBg: "bg-pink-50",   category: "modifier" },
  { id: "X3",     labelKey: "dirX3",     icon: "×3", accent: "text-rose-600",   iconBg: "bg-rose-50",   category: "modifier" },
  { id: "BRANCH", labelKey: "dirBranch", icon: "❓", accent: "text-violet-600", iconBg: "bg-violet-50", category: "branch" },
];

interface RegisteredCard {
  uid: string;
  cardId: string;
}

export default function NfcWriter() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [readerConnected, setReaderConnected] = useState(false);
  const [readerName, setReaderName] = useState("");
  const [registeredCards, setRegisteredCards] = useState<RegisteredCard[]>([]);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const registeredCount = ACTIONS.filter((a) => getCardUid(a.id)).length;
  const progressPct = (registeredCount / ACTIONS.length) * 100;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition"
        aria-expanded={open}
      >
        <span className="text-slate-500">
          <IconChevron open={open} />
        </span>
        <div className="flex-1 text-left">
          <div className="font-bold text-slate-800">{t("nfcCardSetup")}</div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${readerConnected ? "bg-emerald-500" : "bg-rose-400"}`} />
            {readerConnected ? `${t("readerConnected")}${readerName}` : t("readerNotFound")}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-mono font-semibold text-slate-600">
            {registeredCount}<span className="text-slate-400">/{ACTIONS.length}</span>
          </span>
        </div>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="border-t border-slate-100">
          {resultMessage && (
            <div className={`mx-5 mt-4 px-4 py-2.5 rounded-lg text-sm font-medium
              ${resultMessage.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}>
              {resultMessage.text}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider">
                  <th className="px-5 py-2.5 text-left font-semibold w-14">#</th>
                  <th className="px-2 py-2.5 text-left font-semibold">Card</th>
                  <th className="px-2 py-2.5 text-left font-semibold hidden md:table-cell">UID</th>
                  <th className="px-5 py-2.5 text-right font-semibold w-48">Action</th>
                </tr>
              </thead>
              <tbody>
                {ACTIONS.map((action, idx) => {
                  const uid = getCardUid(action.id);
                  const isRegistering = registeringId === action.id;
                  return (
                    <tr
                      key={action.id}
                      className={`border-t border-slate-100 transition ${isRegistering ? "bg-amber-50" : "hover:bg-slate-50/60"}`}
                    >
                      <td className="px-5 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${action.iconBg} ${action.accent} text-2xl font-bold`}>
                            {action.icon}
                          </span>
                          <div>
                            <div className={`font-semibold ${action.accent}`}>{t(action.labelKey)}</div>
                            <div className="text-[11px] text-slate-400 uppercase tracking-wide">{action.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 hidden md:table-cell">
                        {uid ? (
                          <div className="flex items-center gap-1.5">
                            <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <code className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{uid}</code>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isRegistering ? (
                          <button
                            onClick={handleCancel}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300 transition inline-flex items-center gap-1.5"
                          >
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {t("cancel")}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRegister(action)}
                            disabled={!readerConnected || registeringId !== null}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                              uid
                                ? "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                : "bg-slate-900 text-white hover:bg-slate-700"
                            }`}
                          >
                            {uid ? t("reRegister") : t("tapToRegister")}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
