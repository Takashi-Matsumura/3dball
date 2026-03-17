# CLAUDE.md

## Project Overview

3D Ball — Three.js (React Three Fiber) を使った 3D ボール操作アプリ。Next.js 16 App Router ベース。

## Commands

- `npm run dev` — 開発サーバー起動 (http://localhost:3000)
- `npm run build` — プロダクションビルド
- `npm run lint` — ESLint 実行

## Architecture

- **lib/ball-shared.ts** — 共有ロジック (React 非依存)。定数 (`CELL_SIZE`, `BALL_RADIUS`, `COLOR_PRESETS`, カメラプリセット, `NFC_DIRECTIONS`, `NFC_ICONS`)、`PatternConfig` インターフェース、`makeShaderMaterial()`、`moveGrid(gridSize, obstacles?)`、`encodeProgram()` / `decodeProgram()`、`generateRandomPath(gridSize, obstacles?)`、`expandProgram()` / `expandProgramWithMap()` (x2/x3 ループ展開)。
- **lib/levels.ts** — レベル定義 (React 非依存)。`LevelConfig` インターフェース (`obstacleCount?` 含む)、`LEVELS` レジストリ (lv1, lv2)、`generateStartGoal()`、`generateLevel()` (スタート/ゴール/障害物一括生成)、`generateObstacles()` + `hasPath()` (BFS 経路検証)、`generateChallengeCount()`、`gridCenter()`、`checkMoveResult()`、`checkProgramResult()`、`buildLevelNtagParams()`、`encodeObstacles()` / `decodeObstacles()`。新レベル追加時はここに `LevelConfig` エントリを追加する。
- **lib/useLevel.ts** — レベル状態管理フック。`activate(levelId)` / `deactivate()` でレベル ON/OFF。スタート/ゴール/障害物生成、移動カウント、お題、クリア/バースト判定、NTAG パラメータ構築をカプセル化。Ball.tsx から `level.active`, `level.start`, `level.goal`, `level.obstacles` 等で参照。
- **lib/sounds.ts** — Web Audio API による合成効果音 (外部ファイル不要)。`playMove()`, `playJump()`, `playBump()`, `playNfcScan()`, `playSuccess()`, `playBurst()`。
- **app/components/Scene.tsx** — 共有 3D コンポーネント (`CameraController`, `Board`, `Ground`, `Sphere`, `CellMarker`, `TextSprite`, `ObstacleMarker`)。Ball.tsx とリプレイページの両方で使用。`CameraController` はアスペクト比 + `gridSize` に応じてカメラ距離を自動調整 (縦画面・大グリッド対応)。`CellMarker` はパルスリングマーカー、`TextSprite` はキャンバスベースのテキストスプライト (レベルのスタート/ゴール表示用)。`ObstacleMarker` は赤半透明ブロック (Lv2 障害物)。すべてのコンポーネントが `gridSize` パラメータで可変グリッドサイズに対応。`Sphere` はバーストアニメーション (パーティクル散乱) を内蔵。
- **app/Ball.tsx** — メインの 3D シーン。NFC ポーリング、キーボード操作、プログラミングモード、NTAG 書き込みモーダルを含む。レベルロジックは `useLevel` フックに委譲。
- **app/replay/page.tsx** — リプレイページ (サーバーコンポーネント)。URL パラメータからプログラムを読み取り `ReplayScene` に渡す。
- **app/replay/ReplayScene.tsx** — リプレイ UI (クライアントコンポーネント)。ページ読み込み後に自動再生、方向アイコン列ハイライト、Replay ボタン、3D/2D 切替。
- **app/nfc/** — NFC カード登録ページ (UID ベースのマッピング)
- **app/api/nfc/** — NFC API ルート (ステータス、登録、読み取りイベント)
- **app/api/nfc/write/** — NTAG NDEF URL 書き込み API ルート
- **lib/nfc.ts** — nfc-pcsc シングルトン。FeliCa カード対応 (UID マッピング方式) + NTAG NDEF URL 書き込み。動的 require で Vercel 互換。
- **lib/db.ts** — better-sqlite3 による NFC カード登録の永続化 (`data/nfc.db`)。動的 require で Vercel 互換。
- **lib/i18n.tsx** — i18n (ja/en/es)。リプレイページ・NTAG 書き込み関連のキーを含む。

## Key Design Decisions

- ボールの模様はカスタム ShaderMaterial (GLSL) で描画。`uniforms` で色・スケールをリアルタイム変更可能。
- NFC は当初 NDEF 書き込み方式だったが、FeliCa カード (Sony RC-S300) では 0x6982 エラーが発生するため UID ベースのマッピング方式に変更。
- NFC カード登録は SQLite (better-sqlite3) で永続化。インメモリキャッシュと DB を同期。
- プログラミングモード: NFC カードで命令列を作成し、Run で順次実行。実行中はハイライト行を自動スクロール。モード ON 時はキーボード・直接 NFC 操作を無効化。
- 2D モードのカメラは `up` ベクトルを `[0, 0, -1]` に設定することで 3D モードと同じ座標系を維持。方向反転のハックは不要。
- `next.config.ts` で `serverExternalPackages: ["nfc-pcsc", "pcsclite", "better-sqlite3"]` を設定。ネイティブ `.node` アドオンをバンドラーから除外。
- UI パネル (プログラミング・設定) は統一デザイン: 閉じた状態はアイコンのみ、開いた状態はヘッダー (タイトル+閉じるボタン) + ボディ。NFC 接続ステータスはフッターに表示。
- NTAG 書き込み: プログラミングパネルで作成したプログラムを NDEF URL レコードとして NTAG カードに書き込み。フッターに目立たないセーブアイコン → モーダルダイアログ → ソナーアニメーションで待機。
- リプレイページ URL エンコーディング: `/replay?p=UUDLRR&c1=4488ff&c2=ffffff&s=20&pt=0&t=1773557770&lv=lv1&sc=2&sr=2&gc=0&gr=0&ch=5&ob=1223` (p=プログラム, c1/c2=色, s=幅, pt=パターン, t=作成日時 Unix秒, lv=レベルID, sc/sr=スタート位置, gc/gr=ゴール位置, ch=お題の移動数, ob=障害物エンコード `"1223"` = col1row2,col2row3)。レベルパラメータはレベルモード時のみ付加。プログラム文字: U/D/L/R/J=方向・ジャンプ, 2/3=x2/x3ループ。
- `nfc-pcsc` / `better-sqlite3` は `optionalDependencies` に配置し、`lib/nfc.ts` / `lib/db.ts` では動的 `require()` を使用。Vercel 上ではネイティブモジュールが無くてもビルド・デプロイ可能。リプレイページは純粋にクライアントサイドで動作。
- `NEXT_PUBLIC_BASE_URL` 環境変数で NTAG に書き込む URL のベースドメインを指定 (`.env.local` で設定)。未設定時は `window.location.origin` を使用。
- NTAG 書き込み成功後のプレビューは常に `localhost` で開く (外部ドメインだとブラウザのポップアップブロックに引っかかるため)。NTAG 自体には `NEXT_PUBLIC_BASE_URL` のドメインが書き込まれる。
- **middleware.ts**: Vercel 上 (`VERCEL` 環境変数あり) では `/replay` 以外のルートを `/replay` にリライト。ローカル開発には影響なし。
- **効果音**: Web Audio API のオシレーターで合成。移動音 (上昇ブリップ)、ジャンプ音 (上昇トーン)、壁バンプ音 (低音サッド)、NFC 読み取りチャイム (2音チャイム、プログラミングモードのみ)、成功ファンファーレ (C-E-G-C)、バースト音 (破裂ポップ)。外部オーディオファイル不要。
- **レベルシステム**: `lib/levels.ts` で `LevelConfig` を定義し、`lib/useLevel.ts` フックでレベル状態を管理。`Ball.tsx` はレベル固有ロジックを持たず、フックのインターフェースのみに依存。新レベル追加は `LEVELS` レジストリにエントリを追加するだけ。`moveGrid()`, `Board`, `Sphere` 等すべて `gridSize` パラメータで可変グリッドに対応済み。
- **Lv1 モード (低年齢向け STEAM)**: フッターの Lv1 トグル (F1 キー) で ON/OFF (Escape キーで解除)。3x3 グリッド上にランダムなスタート (緑) とゴール (オレンジ) のマーカーを配置 (マンハッタン距離 2 以上)。ゴール到達でファンファーレ + 自動ジャンプ + 「つぎへ」ボタン (Enter キー)。「お題」ボタン (Tab キー) でランダム経路シミュレーションに基づく目標移動数を提示。お題と移動数が不一致でゴール、または移動数超過で**バーストアニメーション** (膨張→パーティクル散乱) + スタートリセット。プログラミングモードとの連携: Run 実行時はスタート位置から開始、途中ゴール通過なし + 最終到達でクリア判定 (失敗時もバースト)、New ボタンで新しいスタート/ゴール生成。NTAG 書き込み時にレベルパラメータ (スタート/ゴール/お題) を URL に含め、リプレイページでも再現。
- **Lv2 モード (障害物 + ループカード)**: フッターの Lv2 トグル (F2 キー) で ON/OFF。5x5 グリッド上にランダムなスタート/ゴール (マンハッタン距離 4 以上) + 2〜4個の障害物 (赤ブロック) を配置。BFS で経路存在を保証。障害物セルにはボールが進入不可 (壁と同じ反応)。お題は障害物を考慮した経路から生成。
- **x2/x3 ループカード**: プログラミングモード専用。直前の命令を繰り返す (x2=計2回, x3=計3回)。連続使用は加算 (`→ x2 x2` = 4回)。プログラミングパネルではグループ表示 (`RIGHT ×3`)。フリー移動では無効。`expandProgram()` / `expandProgramWithMap()` で実行時に展開。
- **キーボードショートカット**: P=プログラミング ON/OFF、S=設定 ON/OFF、F1=Lv1、F2=Lv2、Escape=レベル解除、Tab=お題、Enter=つぎへ (クリア時) / Run (プログラミングモード)、Shift+Enter=New (プログラミングモード)、矢印キー=移動、Space=ジャンプ。

## Deployment

- **Vercel**: https://3dball-hazel.vercel.app — リプレイページ (`/replay`) のみ公開。ミドルウェアで他ルートをブロック。NFC/SQLite 関連のルートは Vercel 上では動作しない (ネイティブモジュール不在)。
- **ローカル**: `npm run dev` でフル機能 (NFC リーダー、プログラミング、NTAG 書き込み、リプレイ)。
- **デプロイ方法**: `vercel --prod` または GitHub push で自動デプロイ。

## Windows Portable Distribution

イベント会場など複数の Windows PC にデプロイするためのポータブル配布機能。Docker は NFC リーダー (PC/SC) のパススルーが困難なため、Node.js ポータブル版を同梱する方式を採用。

### Files

- **scripts/setup.ps1** — 初回セットアップスクリプト。Node.js v22 ポータブル版のダウンロード、`npm install`、プロダクションビルドを実行。
- **scripts/pack.ps1** — セットアップ済みフォルダを `3dball-portable.zip` に圧縮。配布用。
- **start.bat** — サーバー起動 (ダブルクリック)。`.rebuild-needed` フラグがある場合、初回起動時にネイティブモジュール (`better-sqlite3`, `nfc-pcsc`) を自動再ビルド。

### Workflow

1. **準備** (インターネットのある環境で1回): `powershell -ExecutionPolicy Bypass -File scripts\setup.ps1`
2. **ZIP 作成**: `powershell -ExecutionPolicy Bypass -File scripts\pack.ps1` (または macOS から手動で ZIP 作成)
3. **配布**: ZIP を各 Windows PC に展開 → `start.bat` ダブルクリックで起動 → http://localhost:3000

### Notes

- `node/` ディレクトリと `*.zip` は `.gitignore` で除外。
- macOS でビルドした ZIP を Windows で使う場合、`.rebuild-needed` フラグにより初回起動時にネイティブモジュールが自動再ビルドされる。
- NFC リーダーは Windows の PC/SC ドライバ (WinSCard) 経由でアクセス。コンテナ不要。
