# 3D Ball

Three.js で描画した 3D ボールをチェス盤風の 3x3 マス上で転がすインタラクティブアプリケーションです。キーボードの矢印キーまたは NFC カードでボールを操作できます。

## 機能

- **3D / 2D 表示切替** — 斜め視点の 3D モードと、真上から見下ろす 2D モードをスムーズなカメラアニメーションで切り替え
- **ボールの転がりアニメーション** — 移動方向に応じた物理的な回転アニメーション付き
- **模様カスタマイズ** — チェッカー / ストライプの 2 種類。色とパターンの幅をリアルタイムで変更可能
- **NFC カード操作** — USB NFC リーダー (Sony RC-S300 等) を接続し、4 枚のカードに上下左右を割り当てて操作
- **プログラミングモード** — NFC カードで命令列を作成し、Run で順次実行
- **NTAG 書き込み** — 作成したプログラムを NTAG カードに NDEF URL として書き込み、スマホで読み取ってリプレイ
- **リプレイページ** — URL パラメータからプログラムを再生。Vercel で公開中
- **影の描画** — DirectionalLight によるリアルタイムシャドウ

## 技術スタック

- [Next.js](https://nextjs.org/) 16 (App Router)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + [drei](https://github.com/pmndrs/drei)
- [Three.js](https://threejs.org/) (カスタムシェーダーマテリアル)
- [nfc-pcsc](https://github.com/nicedoc/nfc-pcsc) (NFC リーダー連携)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (NFC カード登録の永続化)
- [Tailwind CSS](https://tailwindcss.com/) 4

## セットアップ (開発)

```bash
npm install
npm run dev
```

http://localhost:3000 を開いてください。

## NFC カードの使い方

1. USB NFC リーダーを接続する
2. http://localhost:3000/nfc にアクセス
3. 方向 (上 / 下 / 左 / 右) を選択し「登録する」をクリック
4. NFC カードをリーダーにかざして登録
5. 4 枚のカードにそれぞれ方向を割り当てる
6. メインページでカードをかざすとボールが移動

> NFC 機能は UID ベースのマッピング方式です。FeliCa カード (Suica 等) にも対応しています。カードへの書き込みは行わず、カードの固有 ID とアクションの対応をサーバーメモリに保持します。

## Windows ポータブル配布

イベント会場で複数の Windows PC にデプロイするためのポータブル配布機能です。

### 背景

STEAM ブースとして出展する際、NFC カードリーダー付きの PC を複数台用意する必要があります。Docker は NFC リーダー (PC/SC デバイス) をコンテナにパススルーできないため、Node.js ポータブル版を同梱する方式を採用しました。

### 課題: ネイティブモジュールのクロスプラットフォームビルド

`nfc-pcsc` が依存する `@pokusew/pcsclite` はネイティブ C++ アドオン (`.node` ファイル) です。macOS でビルドした `.node` ファイルは Windows では動作しません (`not a valid Win32 application`)。

Windows 上でリビルド (`npm rebuild`) するには **Python** と **Visual Studio Build Tools** (C++ デスクトップ開発ワークロード) のインストールが必要ですが、これはポータブル配布の「何もインストールしない」という方針に反します。

### 解決策: GitHub Actions でビルド

**GitHub Actions の `windows-latest` ランナー**を使うことで、この問題を完全に解決しました。

- ランナーには Python、Visual Studio Build Tools が**プリインストール済み**
- ネイティブモジュールが Windows 用に正しくコンパイルされる
- ビルド済みの `.next` 出力も同梱されるため、配布先でのビルド不要
- macOS / Linux の開発環境から `gh workflow run` で実行可能

### ビルド手順

1. **ワークフローを実行** (GitHub Actions > "Build Windows Portable ZIP" > Run workflow)
   ```bash
   # CLI からも実行可能
   gh workflow run build-windows.yml
   ```

2. **アーティファクトをダウンロード**
   ```bash
   # 最新のランIDを確認
   gh run list --workflow=build-windows.yml --limit 1

   # ダウンロード
   gh run download <RUN_ID> --name 3dball-portable --dir 3dball-portable-win
   ```

3. **ZIP に圧縮して配布**
   ```bash
   zip -r 3dball-portable.zip 3dball-portable-win/
   ```

### 各 Windows PC での使い方

1. ZIP を展開
2. `start.bat` をダブルクリック
3. http://localhost:3000 にアクセス
4. NFC リーダーは Windows の PC/SC ドライバ (WinSCard) 経由で自動認識

> 配布先の PC には**何もインストールする必要がありません**。Node.js もアプリフォルダ内に自己完結しており、レジストリや PATH の変更は一切行いません。フォルダを削除すれば完全にクリーンアップされます。

### 含まれるファイル

| パス | 内容 |
|------|------|
| `node/` | Node.js v22 ポータブル (Windows x64) |
| `node_modules/` | 全依存パッケージ (Windows 用ネイティブバイナリ含む) |
| `.next/` | ビルド済みプロダクションアプリ |
| `start.bat` | 起動スクリプト (ダブルクリック) |
| `scripts/setup.ps1` | 初回セットアップスクリプト (手動ビルド時用) |
| `scripts/pack.ps1` | ZIP 作成スクリプト (手動ビルド時用) |
| `data/` | SQLite DB 用 (空) |

### ワークフロー設定

`.github/workflows/build-windows.yml` で以下を行っています:

- Node.js 22 + Windows ランナーで `npm install --include=optional`
- `NEXT_PUBLIC_BASE_URL` を設定してプロダクションビルド
- `node -e "require('nfc-pcsc')"` でネイティブモジュールの動作確認
- Node.js ポータブル版をダウンロードして同梱
- アーティファクトとしてアップロード (30日間保持)

## デプロイ

- **Vercel**: https://3dball-hazel.vercel.app — リプレイページ (`/replay`) のみ公開
- **ローカル (macOS)**: `npm run dev` でフル機能
- **Windows ポータブル**: 上記の「Windows ポータブル配布」セクション参照

## プロジェクト構成

```
app/
  page.tsx              # メインページ
  Ball.tsx              # 3D シーン (盤面、ボール、カメラ、操作)
  components/
    Scene.tsx           # 共有 3D コンポーネント
  nfc/
    page.tsx            # NFC カード登録ページ
    NfcWriter.tsx       # 登録 UI コンポーネント
  replay/
    page.tsx            # リプレイページ (サーバーコンポーネント)
    ReplayScene.tsx     # リプレイ UI (クライアントコンポーネント)
  api/nfc/
    route.ts            # NFC ステータス・登録 API
    read/route.ts       # NFC 読み取りイベント API
    write/route.ts      # NTAG 書き込み API
lib/
  ball-shared.ts        # 共有ロジック (定数、シェーダー、エンコード)
  nfc.ts                # NFC リーダー管理 (nfc-pcsc シングルトン)
  db.ts                 # SQLite による NFC カード登録永続化
  i18n.tsx              # i18n (日本語 / 英語)
scripts/
  setup.ps1             # Windows 初回セットアップ
  pack.ps1              # Windows 配布用 ZIP 作成
.github/workflows/
  build-windows.yml     # GitHub Actions: Windows ポータブル ZIP ビルド
```

## 操作方法

| 入力 | 動作 |
|------|------|
| `←` `→` `↑` `↓` キー | ボールを上下左右に移動 |
| NFC カード | 登録した方向にボールを移動 |
| 右上パネル | 表示モード・模様・色・幅の変更 |
| 左上パネル | プログラミングモード (命令列の作成・実行) |
