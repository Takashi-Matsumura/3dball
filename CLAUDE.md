# CLAUDE.md

## Project Overview

3D Ball — Three.js (React Three Fiber) を使った 3D ボール操作アプリ。Next.js 16 App Router ベース。

## Commands

- `npm run dev` — 開発サーバー起動 (http://localhost:3000)
- `npm run build` — プロダクションビルド
- `npm run lint` — ESLint 実行

## Architecture

- **app/Ball.tsx** — メインの 3D シーン。盤面、ボール、カメラ制御、NFC ポーリング、キーボード操作、プログラミングモードをすべて含む。カスタムシェーダー (GLSL) でボールの模様を描画。
- **app/nfc/** — NFC カード登録ページ (UID ベースのマッピング)
- **app/api/nfc/** — NFC API ルート (ステータス、登録、読み取りイベント)
- **lib/nfc.ts** — nfc-pcsc シングルトン。FeliCa カード対応 (NDEF 書き込み不可のため UID マッピング方式)。
- **lib/db.ts** — better-sqlite3 による NFC カード登録の永続化 (`data/nfc.db`)。

## Key Design Decisions

- ボールの模様はカスタム ShaderMaterial (GLSL) で描画。`uniforms` で色・スケールをリアルタイム変更可能。
- NFC は当初 NDEF 書き込み方式だったが、FeliCa カード (Sony RC-S300) では 0x6982 エラーが発生するため UID ベースのマッピング方式に変更。
- NFC カード登録は SQLite (better-sqlite3) で永続化。インメモリキャッシュと DB を同期。
- プログラミングモード: NFC カードで命令列を作成し、Run で順次実行。実行中はハイライト行を自動スクロール。モード ON 時はキーボード・直接 NFC 操作を無効化。
- 2D モードのカメラは `up` ベクトルを `[0, 0, -1]` に設定することで 3D モードと同じ座標系を維持。方向反転のハックは不要。
- `next.config.ts` で `serverExternalPackages: ["nfc-pcsc", "pcsclite", "better-sqlite3"]` を設定。ネイティブ `.node` アドオンをバンドラーから除外。
- UI パネル (プログラミング・設定) は統一デザイン: 閉じた状態はアイコンのみ、開いた状態はヘッダー (タイトル+閉じるボタン) + ボディ。NFC 接続ステータスはフッターに表示。
