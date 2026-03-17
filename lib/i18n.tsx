"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export type Locale = "ja" | "en" | "es";

const translations = {
  // Ball.tsx
  checker: { ja: "チェッカー", en: "Checker", es: "Cuadros" },
  stripe: { ja: "ストライプ", en: "Stripe", es: "Rayas" },
  programming: { ja: "プログラミング", en: "Programming", es: "Programaci\u00f3n" },
  close: { ja: "閉じる", en: "Close", es: "Cerrar" },
  scanCardToAdd: { ja: "カードをかざして\n命令を追加", en: "Tap a card\nto add a command", es: "Acerca una tarjeta\npara agregar" },
  running: { ja: "実行中...", en: "Running...", es: "Ejecutando..." },
  run: { ja: "Run", en: "Run", es: "Run" },
  settings: { ja: "設定", en: "Settings", es: "Ajustes" },
  mode3D: { ja: "3D モード", en: "3D Mode", es: "Modo 3D" },
  mode2D: { ja: "2D モード", en: "2D Mode", es: "Modo 2D" },
  color1: { ja: "色 1", en: "Color 1", es: "Color 1" },
  color2: { ja: "色 2", en: "Color 2", es: "Color 2" },
  width: { ja: "幅", en: "Width", es: "Ancho" },
  nfcCardRegister: { ja: "NFC カード登録", en: "NFC Card Setup", es: "Registro NFC" },
  nfcConnected: { ja: "NFC 接続中", en: "NFC Connected", es: "NFC Conectado" },
  nfcDisconnected: { ja: "NFC 未接続", en: "NFC Disconnected", es: "NFC Desconectado" },

  // NfcWriter.tsx
  dirUp: { ja: "上 (Up)", en: "Up", es: "Arriba" },
  dirDown: { ja: "下 (Down)", en: "Down", es: "Abajo" },
  dirLeft: { ja: "左 (Left)", en: "Left", es: "Izquierda" },
  dirRight: { ja: "右 (Right)", en: "Right", es: "Derecha" },
  dirJump: { ja: "ジャンプ (Jump)", en: "Jump", es: "Salto" },
  waitingForCard: { ja: "カードをリーダーにかざしてください...", en: "Tap a card on the reader...", es: "Acerca una tarjeta al lector..." },
  registered: { ja: "として登録しました！", en: "registered!", es: "\u00a1registrada!" },
  registerFailed: { ja: "登録に失敗しました。", en: "Registration failed.", es: "Error en el registro." },
  commError: { ja: "通信エラー: ", en: "Connection error: ", es: "Error de conexi\u00f3n: " },
  goBack: { ja: "← もどる", en: "← Back", es: "← Volver" },
  nfcCardSetup: { ja: "NFC カード登録", en: "NFC Card Setup", es: "Registro de tarjetas NFC" },
  readerConnected: { ja: "リーダー接続中: ", en: "Reader connected: ", es: "Lector conectado: " },
  readerNotFound: { ja: "NFCリーダーが見つかりません — USBリーダーを接続してください", en: "NFC reader not found — connect a USB reader", es: "Lector NFC no encontrado — conecta un lector USB" },
  registeredCards: { ja: "登録済みカード", en: "Registered Cards", es: "Tarjetas registradas" },
  noCardsYet: { ja: "まだカードが登録されていません", en: "No cards registered yet", es: "A\u00fan no hay tarjetas registradas" },
  selectDirAndTap: { ja: "方向を選んでカードをかざして登録", en: "Select a direction and tap a card to register", es: "Elige una direcci\u00f3n y acerca una tarjeta" },
  waitingCard: { ja: "カードを待っています...", en: "Waiting for card...", es: "Esperando tarjeta..." },
  registerBtn: { ja: "を登録する", en: "Register", es: "Registrar" },
  tapToRegister: { ja: "カードをかざして登録", en: "Tap card to register", es: "Acerca una tarjeta" },
  reRegister: { ja: "再登録", en: "Re-register", es: "Re-registrar" },
  cancel: { ja: "キャンセル", en: "Cancel", es: "Cancelar" },
  language: { ja: "言語", en: "Language", es: "Idioma" },

  // Replay page
  replay: { ja: "リプレイ", en: "Replay", es: "Repetir" },
  replayAgain: { ja: "もう一度見る", en: "Watch Again", es: "Ver de nuevo" },
  noProgram: { ja: "プログラムが指定されていません", en: "No program specified", es: "No se especific\u00f3 un programa" },
  steps: { ja: "ステップ", en: "steps", es: "pasos" },

  // Lv1 mode
  lv1: { ja: "Lv1", en: "Lv1", es: "Lv1" },
  lv1Theme: { ja: "ゴールをめざそう！", en: "Reach the Goal!", es: "\u00a1Llega a la meta!" },
  lv1Challenge: { ja: "お題", en: "Challenge", es: "Reto" },
  lv1ChallengeTheme: { ja: "回でゴールをめざそう！", en: " moves to the Goal!", es: " movimientos a la meta!" },

  // Lv2 mode
  lv2: { ja: "Lv2", en: "Lv2", es: "Lv2" },
  lv2Theme: { ja: "障害物をさけてゴール！", en: "Avoid obstacles!", es: "\u00a1Evita obst\u00e1culos!" },
  lv2ChallengeTheme: { ja: "回で障害物をさけてゴール！", en: " moves, avoid obstacles!", es: " movimientos, \u00a1evita!" },

  // Lv3 mode
  lv3: { ja: "Lv3", en: "Lv3", es: "Lv3" },
  lv3Theme: { ja: "？で分岐してゴール！", en: "Branch at ? to Goal!", es: "¡Bifurca en ? a la meta!" },
  lv3ChallengeTheme: { ja: "回で？を使ってゴール！", en: " moves, use ? to Goal!", es: " movimientos, ¡usa ?!" },

  // Loop cards
  dirX2: { ja: "×2 (くりかえし)", en: "\u00d72 (Repeat)", es: "\u00d72 (Repetir)" },
  dirX3: { ja: "×3 (くりかえし)", en: "\u00d73 (Repeat)", es: "\u00d73 (Repetir)" },
  nextChallenge: { ja: "つぎへ", en: "Next", es: "Siguiente" },
  start: { ja: "スタート", en: "START", es: "INICIO" },
  goal: { ja: "ゴール", en: "GOAL", es: "META" },

  // NTAG write
  saveToNtag: { ja: "NTAGに保存", en: "Save to NTAG", es: "Guardar en NTAG" },
  saveToNtagDesc: { ja: "NTAGカードにプログラムを書き込みます。\nカードをリーダーにかざしてください。", en: "Write the program to an NTAG card.\nTap a card on the reader.", es: "Escribe el programa en una tarjeta NTAG.\nAcerca una tarjeta al lector." },
  tapNtagToWrite: { ja: "NTAGカードをかざしてください...", en: "Tap an NTAG card...", es: "Acerca una tarjeta NTAG..." },
  writeSuccess: { ja: "書き込み完了！", en: "Written!", es: "\u00a1Escrito!" },
  writeFailed: { ja: "書き込みに失敗しました", en: "Write failed", es: "Error de escritura" },
  waitingForNtag: { ja: "NTAGを待っています...", en: "Waiting for NTAG...", es: "Esperando NTAG..." },
} as const;

export type TranslationKey = keyof typeof translations;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  /** Dynamic key lookup (for config-driven keys). Returns key itself if not found. */
  td: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "ja",
  setLocale: () => {},
  t: (key) => translations[key].ja,
  td: (key) => (translations as Record<string, Record<string, string>>)[key]?.ja ?? key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ja");

  useEffect(() => {
    const saved = localStorage.getItem("locale");
    if (saved === "ja" || saved === "en" || saved === "es") {
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

  const td = useCallback(
    (key: string) => (translations as Record<string, Record<string, string>>)[key]?.[locale] ?? key,
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, td }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
