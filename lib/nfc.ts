/* eslint-disable @typescript-eslint/no-explicit-any */
import { NFC } from "nfc-pcsc";

// ---- UID-based card mapping ----
// Maps card UID → direction (e.g., "UP", "DOWN", "LEFT", "RIGHT")
const uidMap: Map<string, string> = new Map();

export function registerCard(uid: string, cardId: string): void {
  uidMap.set(uid, cardId);
  console.log(`[NFC] Registered UID=${uid} → ${cardId}`);
}

export function getRegisteredCards(): Array<{ uid: string; cardId: string }> {
  return Array.from(uidMap.entries()).map(([uid, cardId]) => ({ uid, cardId }));
}

export function removeCard(uid: string): void {
  uidMap.delete(uid);
}

// ---- Singleton NFC manager ----

export interface NfcReadEvent {
  cardId: string;
  uid: string;
  timestamp: number;
}

let nfc: any = null;
let activeReader: any = null;
let readerName: string = "";

// Read event queue — consumers poll and drain this
let readEvents: NfcReadEvent[] = [];
let lastSeenUid: string = "";

// Registration mode: when set, next card tap registers with this cardId
let pendingRegister: {
  cardId: string;
  resolve: (info: { uid: string }) => void;
  reject: (err: Error) => void;
} | null = null;

function ensureNfc() {
  if (nfc) return;
  nfc = new NFC();

  nfc.on("reader", (reader: any) => {
    activeReader = reader;
    readerName = reader.reader.name;
    console.log(`[NFC] Reader connected: ${readerName}`);

    reader.on("card", async (card: any) => {
      console.log(`[NFC] Card detected: UID=${card.uid}`);

      // --- Registration mode ---
      if (pendingRegister) {
        const req = pendingRegister;
        pendingRegister = null;
        registerCard(card.uid, req.cardId);
        req.resolve({ uid: card.uid });
        return;
      }

      // --- Read mode (default) ---
      if (card.uid === lastSeenUid) return;
      lastSeenUid = card.uid;

      const cardId = uidMap.get(card.uid);
      if (cardId) {
        console.log(`[NFC] Matched UID=${card.uid} → ${cardId}`);
        readEvents.push({ cardId, uid: card.uid, timestamp: Date.now() });
      } else {
        console.log(`[NFC] Unknown card UID=${card.uid} (not registered)`);
      }
    });

    reader.on("card.off", (card: any) => {
      console.log(`[NFC] Card removed: UID=${card.uid}`);
      if (card.uid === lastSeenUid) {
        lastSeenUid = "";
      }
    });

    reader.on("error", (err: any) => {
      console.error(`[NFC] Reader error:`, err);
    });

    reader.on("end", () => {
      console.log(`[NFC] Reader disconnected: ${readerName}`);
      if (activeReader === reader) {
        activeReader = null;
        readerName = "";
      }
    });
  });

  nfc.on("error", (err: any) => {
    console.error("[NFC] NFC error:", err);
  });
}

/** Get current reader status. */
export function getStatus(): { connected: boolean; readerName: string; waiting: boolean } {
  ensureNfc();
  return {
    connected: activeReader !== null,
    readerName,
    waiting: pendingRegister !== null,
  };
}

/** Drain all pending read events (returns and clears the queue). */
export function drainReadEvents(): NfcReadEvent[] {
  ensureNfc();
  const events = readEvents;
  readEvents = [];
  return events;
}

/**
 * Queue a registration request. Resolves when a card is tapped.
 * The card's UID will be mapped to the given cardId.
 */
export function registerNextCard(cardId: string, timeoutMs = 30000): Promise<{ uid: string }> {
  ensureNfc();

  if (!activeReader) {
    return Promise.reject(new Error("NFCリーダーが接続されていません。"));
  }

  if (pendingRegister) {
    pendingRegister.reject(new Error("新しい登録リクエストで上書きされました。"));
    pendingRegister = null;
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingRegister?.cardId === cardId) {
        pendingRegister = null;
        reject(new Error("タイムアウト: カードが検出されませんでした。"));
      }
    }, timeoutMs);

    pendingRegister = {
      cardId,
      resolve: (info) => {
        clearTimeout(timer);
        resolve(info);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    };
  });
}

/** Cancel any pending registration. */
export function cancelRegister(): void {
  if (pendingRegister) {
    pendingRegister.reject(new Error("キャンセルされました。"));
    pendingRegister = null;
  }
}
