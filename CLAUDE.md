# CLAUDE.md

## Project Overview

3D Ball — Three.js (React Three Fiber) を使った 3D ボール操作アプリ。Next.js 16 App Router ベース。

## Commands

- `npm run dev` — 開発サーバー起動 (http://localhost:3000)
- `npm run build` — プロダクションビルド
- `npm run lint` — ESLint 実行

## Architecture

- **lib/ball-shared.ts** — 共有ロジック (React 非依存)。定数 (`CELL_SIZE`, `BALL_RADIUS`, `COLOR_PRESETS`, カメラプリセット, `NFC_DIRECTIONS`, `NFC_ICONS`)、`PatternConfig` インターフェース、`makeShaderMaterial()`、`moveGrid()`、`encodeProgram()` / `decodeProgram()`。
- **app/components/Scene.tsx** — 共有 3D コンポーネント (`CameraController`, `Board`, `Ground`, `Sphere`)。Ball.tsx とリプレイページの両方で使用。
- **app/Ball.tsx** — メインの 3D シーン。NFC ポーリング、キーボード操作、プログラミングモード、NTAG 書き込みモーダルを含む。共有モジュールからインポート。
- **app/replay/page.tsx** — リプレイページ (サーバーコンポーネント)。URL パラメータからプログラムを読み取り `ReplayScene` に渡す。
- **app/replay/ReplayScene.tsx** — リプレイ UI (クライアントコンポーネント)。ページ読み込み後に自動再生、方向アイコン列ハイライト、Replay ボタン、3D/2D 切替。
- **app/nfc/** — NFC カード登録ページ (UID ベースのマッピング)
- **app/api/nfc/** — NFC API ルート (ステータス、登録、読み取りイベント)
- **app/api/nfc/write/** — NTAG NDEF URL 書き込み API ルート
- **lib/nfc.ts** — nfc-pcsc シングルトン。FeliCa カード対応 (UID マッピング方式) + NTAG NDEF URL 書き込み。動的 require で Vercel 互換。
- **lib/db.ts** — better-sqlite3 による NFC カード登録の永続化 (`data/nfc.db`)。動的 require で Vercel 互換。
- **lib/i18n.tsx** — i18n (ja/en)。リプレイページ・NTAG 書き込み関連のキーを含む。

## Key Design Decisions

- ボールの模様はカスタム ShaderMaterial (GLSL) で描画。`uniforms` で色・スケールをリアルタイム変更可能。
- NFC は当初 NDEF 書き込み方式だったが、FeliCa カード (Sony RC-S300) では 0x6982 エラーが発生するため UID ベースのマッピング方式に変更。
- NFC カード登録は SQLite (better-sqlite3) で永続化。インメモリキャッシュと DB を同期。
- プログラミングモード: NFC カードで命令列を作成し、Run で順次実行。実行中はハイライト行を自動スクロール。モード ON 時はキーボード・直接 NFC 操作を無効化。
- 2D モードのカメラは `up` ベクトルを `[0, 0, -1]` に設定することで 3D モードと同じ座標系を維持。方向反転のハックは不要。
- `next.config.ts` で `serverExternalPackages: ["nfc-pcsc", "pcsclite", "better-sqlite3"]` を設定。ネイティブ `.node` アドオンをバンドラーから除外。
- UI パネル (プログラミング・設定) は統一デザイン: 閉じた状態はアイコンのみ、開いた状態はヘッダー (タイトル+閉じるボタン) + ボディ。NFC 接続ステータスはフッターに表示。
- NTAG 書き込み: プログラミングパネルで作成したプログラムを NDEF URL レコードとして NTAG カードに書き込み。フッターに目立たないセーブアイコン → モーダルダイアログ → ソナーアニメーションで待機。
- リプレイページ URL エンコーディング: `/replay?p=UUDLRR&c1=4488ff&c2=ffffff&s=20&pt=0&t=1773557770` (p=プログラム, c1/c2=色, s=幅, pt=パターン, t=作成日時 Unix秒)。
- `nfc-pcsc` / `better-sqlite3` は `optionalDependencies` に配置し、`lib/nfc.ts` / `lib/db.ts` では動的 `require()` を使用。Vercel 上ではネイティブモジュールが無くてもビルド・デプロイ可能。リプレイページは純粋にクライアントサイドで動作。
- `NEXT_PUBLIC_BASE_URL` 環境変数で NTAG に書き込む URL のベースドメインを指定 (`.env.local` で設定)。未設定時は `window.location.origin` を使用。

## Deployment

- **Vercel**: https://3dball-hazel.vercel.app — リプレイページ (`/replay`) が主な用途。NFC/SQLite 関連のルートは Vercel 上では動作しない (ネイティブモジュール不在)。
- **ローカル**: `npm run dev` でフル機能 (NFC リーダー、プログラミング、NTAG 書き込み、リプレイ)。
