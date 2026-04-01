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

  // Loop cards & branch
  dirX2: { ja: "×2 (Loop2)", en: "\u00d72 (Loop2)", es: "\u00d72 (Loop2)" },
  dirX3: { ja: "×3 (Loop3)", en: "\u00d73 (Loop3)", es: "\u00d73 (Loop3)" },
  dirBranch: { ja: "？ (Which?)", en: "? (Which?)", es: "? (Which?)" },
  ifBlock: { ja: "もし", en: "if", es: "si" },
  elseBlock: { ja: "それ以外", en: "else", es: "si no" },
  tapElse: { ja: "else に切替", en: "Switch to else", es: "Cambiar a else" },
  closePBlock: { ja: "分岐を閉じる", en: "Close branch", es: "Cerrar bifurcación" },
  nextChallenge: { ja: "つぎへ", en: "Next", es: "Siguiente" },
  newMap: { ja: "マップ変更", en: "New Map", es: "Nuevo mapa" },
  start: { ja: "スタート", en: "START", es: "INICIO" },
  goal: { ja: "ゴール", en: "GOAL", es: "META" },

  // NTAG write
  saveToNtag: { ja: "NTAGに保存", en: "Save to NTAG", es: "Guardar en NTAG" },
  saveToNtagDesc: { ja: "NTAGカードにプログラムを書き込みます。\nカードをリーダーにかざしてください。", en: "Write the program to an NTAG card.\nTap a card on the reader.", es: "Escribe el programa en una tarjeta NTAG.\nAcerca una tarjeta al lector." },
  tapNtagToWrite: { ja: "NTAGカードをかざしてください...", en: "Tap an NTAG card...", es: "Acerca una tarjeta NTAG..." },
  writeSuccess: { ja: "書き込み完了！", en: "Written!", es: "\u00a1Escrito!" },
  writeFailed: { ja: "書き込みに失敗しました", en: "Write failed", es: "Error de escritura" },
  waitingForNtag: { ja: "NTAGを待っています...", en: "Waiting for NTAG...", es: "Esperando NTAG..." },

  // Guide — context hints
  guidePlayground: { ja: "Lv1 をおしてスタート！🎮", en: "Press Lv1 to start! 🎮", es: "¡Presiona Lv1 para empezar! 🎮" },
  guideLv1Intro: { ja: "🟢→🟠 ボールをゴールへうごかそう！", en: "🟢→🟠 Move the ball to the goal!", es: "🟢→🟠 ¡Mueve la bola a la meta!" },
  guideLv2Intro: { ja: "🔴障害物をよけてゴール！×2/×3で繰り返し", en: "Dodge 🔴! Use ×2/×3 to repeat", es: "¡Esquiva 🔴! Usa ×2/×3 para repetir" },
  guideLv3Intro: { ja: "🟣？で道が分岐する！条件を読もう", en: "🟣 ? splits the path! Read the conditions", es: "🟣 ¡? divide el camino! Lee las condiciones" },
  guideProgFirst: { ja: "カードをかざして めいれいをついか 📲", en: "Tap a card to add a command 📲", es: "Acerca una tarjeta para agregar 📲" },
  guideCleared: { ja: "🎉 クリア！つぎへいこう！", en: "🎉 Cleared! Let's go next!", es: "🎉 ¡Completado! ¡Vamos!" },

  // Guide — help panel
  helpTitle: { ja: "ガイド", en: "Guide", es: "Guía" },
  helpMission: { ja: "ミッション", en: "Mission", es: "Misión" },
  helpSteps: { ja: "やりかた", en: "How to play", es: "Cómo jugar" },
  helpConcept: { ja: "学べること", en: "You will learn", es: "Aprenderás" },
  helpShortcuts: { ja: "ショートカット", en: "Shortcuts", es: "Atajos" },

  // Guide — playground
  helpTitlePlayground: { ja: "じゆうにあそぼう！", en: "Free Play!", es: "¡Juego libre!" },
  helpObjPlayground: { ja: "ボールをじゆうにうごかしてみよう", en: "Move the ball around freely", es: "Mueve la bola libremente" },
  helpConceptPlayground: { ja: "入力と出力 — ボタンを押すとボールが動く", en: "Input & Output — press a button, ball moves", es: "Entrada y salida — presiona un botón, la bola se mueve" },
  helpStepPlayground1: { ja: "⬆⬇⬅➡ やじるしキー か カードでボールをうごかそう", en: "⬆⬇⬅➡ Use arrow keys or cards to move", es: "⬆⬇⬅➡ Usa flechas o tarjetas para mover" },
  helpStepPlayground2: { ja: "スペースキーでジャンプ！", en: "Press Space to jump!", es: "¡Presiona Espacio para saltar!" },
  helpStepPlayground3: { ja: "できたら Lv1 にいこう！", en: "Ready? Try Lv1!", es: "¿Listo? ¡Prueba Lv1!" },

  // Guide — Lv1
  helpTitleLv1: { ja: "Lv1: じゅんばんにうごかそう", en: "Lv1: Move step by step", es: "Lv1: Mueve paso a paso" },
  helpObjLv1: { ja: "ボールをゴールまでうごかそう！", en: "Move the ball to the goal!", es: "¡Mueve la bola a la meta!" },
  helpConceptLv1: { ja: "逐次処理 — 命令を順番にひとつずつ実行する", en: "Sequential — run commands one by one", es: "Secuencial — ejecutar uno por uno" },
  helpStepLv1_1: { ja: "🟢 みどり＝スタート、🟠 オレンジ＝ゴール", en: "🟢 Green = Start, 🟠 Orange = Goal", es: "🟢 Verde = Inicio, 🟠 Naranja = Meta" },
  helpStepLv1_2: { ja: "やじるしキーで 1マスずつうごかそう", en: "Use arrow keys to move one step at a time", es: "Usa las flechas para mover paso a paso" },
  helpStepLv1_3: { ja: "P でプログラミング → カードでめいれいをならべよう", en: "P for Programming → stack cards to plan", es: "P para Programar → apila tarjetas" },
  helpStepLv1_4: { ja: "Run をおしてじっこう！", en: "Press Run to go!", es: "¡Presiona Run para ejecutar!" },

  // Guide — Lv2 (小学校中学年向け — 漢字を増やし、少し説明的に)
  helpTitleLv2: { ja: "Lv2: 繰り返しを使ってゴール", en: "Lv2: Use loops to reach goal", es: "Lv2: Usa bucles para llegar" },
  helpObjLv2: { ja: "障害物をよけてゴールしよう！", en: "Dodge obstacles and reach the goal!", es: "¡Esquiva obstáculos y llega a la meta!" },
  helpConceptLv2: { ja: "繰り返し処理 — 同じ命令を何度も実行する", en: "Loops — repeat the same command", es: "Bucles — repetir el mismo comando" },
  helpStepLv2_1: { ja: "🔴 赤いブロックは通れない壁だよ", en: "🔴 Red blocks are walls!", es: "🔴 ¡Los bloques rojos son muros!" },
  helpStepLv2_2: { ja: "×2/×3 カードで同じ方向を繰り返そう", en: "Use ×2/×3 cards to repeat a direction", es: "Usa tarjetas ×2/×3 para repetir" },
  helpStepLv2_3: { ja: "例えば「→ ×3」で右に 3マス進む", en: "e.g. → ×3 = move right 3 times", es: "ej. → ×3 = mover derecha 3 veces" },
  helpStepLv2_4: { ja: "少ないカードでクリアできるかな？", en: "Can you clear with fewer cards?", es: "¿Puedes completar con menos tarjetas?" },

  // Guide — Lv3 (小学校高学年向け — 漢字多め、論理的な説明)
  helpTitleLv3: { ja: "Lv3: 条件分岐を使おう", en: "Lv3: Use conditionals", es: "Lv3: Usa condicionales" },
  helpObjLv3: { ja: "🟣分岐セルを通ってゴールしよう！", en: "Pass through 🟣? to reach the goal!", es: "¡Pasa por 🟣? para llegar!" },
  helpConceptLv3: { ja: "条件分岐 — 条件によって進む道が変わる (if/else)", en: "Conditionals — the path changes (if/else)", es: "Condicionales — el camino cambia (if/else)" },
  helpStepLv3_1: { ja: "🟣？セルに乗ると進む方向が変わる", en: "🟣 ? cells change your direction", es: "🟣 Las celdas ? cambian tu dirección" },
  helpStepLv3_2: { ja: "横から来ると縦方向へ、縦から来ると横方向へ分岐", en: "Horizontal → vertical, vertical → horizontal", es: "Horizontal → vertical, vertical → horizontal" },
  helpStepLv3_3: { ja: "？カードで if/else ブロックを作ろう", en: "Use ? card for if/else blocks", es: "Usa tarjeta ? para bloques if/else" },
  helpStepLv3_4: { ja: "必ず？セルを通ること！", en: "You must pass through a ? cell!", es: "¡Debes pasar por una celda ?!" },

  // Guide — shortcuts table
  shortcutArrows: { ja: "⬆⬇⬅➡ うごく", en: "⬆⬇⬅➡ Move", es: "⬆⬇⬅➡ Mover" },
  shortcutSpace: { ja: "Space ジャンプ", en: "Space Jump", es: "Space Saltar" },
  shortcutP: { ja: "P プログラミング", en: "P Programming", es: "P Programar" },
  shortcutD: { ja: "D 2D/3Dきりかえ", en: "D 2D/3D toggle", es: "D Cambiar 2D/3D" },
  shortcutF: { ja: "F1-F3 レベル", en: "F1-F3 Level", es: "F1-F3 Nivel" },
  shortcutH: { ja: "H ガイド", en: "H Guide", es: "H Guía" },
  shortcutLang: { ja: "J/E/N ことば", en: "J/E/N Language", es: "J/E/N Idioma" },

  // Guide — font size setting
  guideFontSize: { ja: "ガイド文字サイズ", en: "Guide font size", es: "Tamaño de fuente guía" },
  guideFontSmall: { ja: "小", en: "S", es: "P" },
  guideFontMedium: { ja: "中", en: "M", es: "M" },
  guideFontLarge: { ja: "大", en: "L", es: "G" },
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
