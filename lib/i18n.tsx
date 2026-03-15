"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export type Locale = "ja" | "en";

const translations = {
  // Ball.tsx
  checker: { ja: "チェッカー", en: "Checker" },
  stripe: { ja: "ストライプ", en: "Stripe" },
  programming: { ja: "プログラミング", en: "Programming" },
  close: { ja: "閉じる", en: "Close" },
  scanCardToAdd: { ja: "カードをかざして\n命令を追加", en: "Tap a card\nto add a command" },
  running: { ja: "実行中...", en: "Running..." },
  run: { ja: "Run", en: "Run" },
  settings: { ja: "設定", en: "Settings" },
  mode3D: { ja: "3D モード", en: "3D Mode" },
  mode2D: { ja: "2D モード", en: "2D Mode" },
  color1: { ja: "色 1", en: "Color 1" },
  color2: { ja: "色 2", en: "Color 2" },
  width: { ja: "幅", en: "Width" },
  nfcCardRegister: { ja: "NFC カード登録", en: "NFC Card Setup" },
  nfcConnected: { ja: "NFC 接続中", en: "NFC Connected" },
  nfcDisconnected: { ja: "NFC 未接続", en: "NFC Disconnected" },

  // NfcWriter.tsx
  dirUp: { ja: "上 (Up)", en: "Up" },
  dirDown: { ja: "下 (Down)", en: "Down" },
  dirLeft: { ja: "左 (Left)", en: "Left" },
  dirRight: { ja: "右 (Right)", en: "Right" },
  waitingForCard: { ja: "カードをリーダーにかざしてください...", en: "Tap a card on the reader..." },
  registered: { ja: "として登録しました！", en: "registered!" },
  registerFailed: { ja: "登録に失敗しました。", en: "Registration failed." },
  commError: { ja: "通信エラー: ", en: "Connection error: " },
  goBack: { ja: "← もどる", en: "← Back" },
  nfcCardSetup: { ja: "NFC カード登録", en: "NFC Card Setup" },
  readerConnected: { ja: "リーダー接続中: ", en: "Reader connected: " },
  readerNotFound: { ja: "NFCリーダーが見つかりません — USBリーダーを接続してください", en: "NFC reader not found — connect a USB reader" },
  registeredCards: { ja: "登録済みカード", en: "Registered Cards" },
  noCardsYet: { ja: "まだカードが登録されていません", en: "No cards registered yet" },
  selectDirAndTap: { ja: "方向を選んでカードをかざして登録", en: "Select a direction and tap a card to register" },
  waitingCard: { ja: "カードを待っています...", en: "Waiting for card..." },
  registerBtn: { ja: "を登録する", en: "Register" },
  cancel: { ja: "キャンセル", en: "Cancel" },
  language: { ja: "言語", en: "Language" },

  // Replay page
  replay: { ja: "リプレイ", en: "Replay" },
  replayAgain: { ja: "もう一度見る", en: "Watch Again" },
  noProgram: { ja: "プログラムが指定されていません", en: "No program specified" },
  steps: { ja: "ステップ", en: "steps" },

  // NTAG write
  saveToNtag: { ja: "NTAGに保存", en: "Save to NTAG" },
  saveToNtagDesc: { ja: "NTAGカードにプログラムを書き込みます。\nカードをリーダーにかざしてください。", en: "Write the program to an NTAG card.\nTap a card on the reader." },
  tapNtagToWrite: { ja: "NTAGカードをかざしてください...", en: "Tap an NTAG card..." },
  writeSuccess: { ja: "書き込み完了！", en: "Written!" },
  writeFailed: { ja: "書き込みに失敗しました", en: "Write failed" },
  waitingForNtag: { ja: "NTAGを待っています...", en: "Waiting for NTAG..." },
} as const;

type TranslationKey = keyof typeof translations;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "ja",
  setLocale: () => {},
  t: (key) => translations[key].ja,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ja");

  useEffect(() => {
    const saved = localStorage.getItem("locale");
    if (saved === "ja" || saved === "en") {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translations[key][locale],
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
