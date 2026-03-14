# 3D Ball

Three.js で描画した 3D ボールをチェス盤風の 3x3 マス上で転がすインタラクティブアプリケーションです。キーボードの矢印キーまたは NFC カードでボールを操作できます。

## 機能

- **3D / 2D 表示切替** — 斜め視点の 3D モードと、真上から見下ろす 2D モードをスムーズなカメラアニメーションで切り替え
- **ボールの転がりアニメーション** — 移動方向に応じた物理的な回転アニメーション付き
- **模様カスタマイズ** — チェッカー / ストライプの 2 種類。色とパターンの幅をリアルタイムで変更可能
- **NFC カード操作** — USB NFC リーダー (Sony RC-S300 等) を接続し、4 枚のカードに上下左右を割り当てて操作
- **影の描画** — DirectionalLight によるリアルタイムシャドウ

## 技術スタック

- [Next.js](https://nextjs.org/) 16 (App Router)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) + [drei](https://github.com/pmndrs/drei)
- [Three.js](https://threejs.org/) (カスタムシェーダーマテリアル)
- [nfc-pcsc](https://github.com/nicedoc/nfc-pcsc) (NFC リーダー連携)
- [Tailwind CSS](https://tailwindcss.com/) 4

## セットアップ

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

## プロジェクト構成

```
app/
  page.tsx          # メインページ
  Ball.tsx          # 3D シーン (盤面、ボール、カメラ、操作)
  nfc/
    page.tsx        # NFC カード登録ページ
    NfcWriter.tsx   # 登録 UI コンポーネント
  api/nfc/
    route.ts        # NFC ステータス・登録 API
    read/route.ts   # NFC 読み取りイベント API
lib/
  nfc.ts            # NFC リーダー管理 (nfc-pcsc シングルトン)
```

## 操作方法

| 入力 | 動作 |
|------|------|
| `←` `→` `↑` `↓` キー | ボールを上下左右に移動 |
| NFC カード | 登録した方向にボールを移動 |
| 右上パネル | 表示モード・模様・色・幅の変更 |
