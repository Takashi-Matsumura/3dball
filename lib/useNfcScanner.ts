"use client";

import { useEffect, useRef, useState } from "react";
import { NFC_DIRECTIONS } from "./ball-shared";

interface UseNfcScannerOptions {
  /** Called once per card event received from the reader. The caller decides
   *  how to respond (move ball, append to program, etc.) and typically calls
   *  `setFlash()` to trigger the on-screen NFC indicator. */
  onCard: (cardId: string) => void;
  /** Polling interval in ms. Default 400. */
  intervalMs?: number;
}

export interface UseNfcScannerResult {
  nfcConnected: boolean;
  nfcFlash: string | null;
  /** Show the NFC flash indicator for `durationMs` then clear it. */
  setFlash: (cardId: string, durationMs: number) => void;
}

/** Polls /api/nfc/read, exposes reader status + flash UI state, and forwards
 *  each valid card event through `onCard`. The `onCard` callback is stored in
 *  a ref so consumers can pass fresh closures without re-subscribing. */
export function useNfcScanner({ onCard, intervalMs = 400 }: UseNfcScannerOptions): UseNfcScannerResult {
  const [nfcConnected, setNfcConnected] = useState(false);
  const [nfcFlash, setNfcFlash] = useState<string | null>(null);
  const onCardRef = useRef(onCard);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onCardRef.current = onCard; }, [onCard]);

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
          onCardRef.current(cardId);
        }
      } catch {
        // ignore — next poll will retry
      }
    };
    poll();
    const id = setInterval(poll, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [intervalMs]);

  const setFlash = (cardId: string, durationMs: number) => {
    setNfcFlash(cardId);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setNfcFlash(null), durationMs);
  };

  return { nfcConnected, nfcFlash, setFlash };
}
