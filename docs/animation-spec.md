# アニメーション仕様（参照用） — Party Mode Default

## 目的
派手モード（`party`）とマスコット演出を **機能ロジック（API/課金/DB/他ツール）に影響させず** に、任意のページへ安全に展開できるようにする。

この仕様は「UI構成」ではなく **アニメーション（動き）だけ**を定義する。

---

## 1. モード（ON/OFF）— デフォルトは `party`

### 1.1 型定義
```ts
export type MotionMode = 'party' | 'minimal'
```

### 1.2 デフォルト
- **デフォルトは `party`**

### 1.3 切替方式（どれでも可）
- **UIトグル**（ユーザーが切替）
- **クエリ**：`?motion=party|minimal`
- **環境変数**：`NEXT_PUBLIC_MOTION_MODE=party`

---

## 2. 機能に影響を出さないための設計原則（最重要）

- アニメーションは **表示層のみ**で完結させる
- 既存の処理フローは変えず、以下の **イベント**だけを受け取って演出する
  - `onStart()` / `onSuccess()` / `onError()` / `onCancel()`
- **APIレスポンス/DB/課金仕様を変更しない**
  - 追加が必要なら `optional` だけ（既存利用側が壊れないこと）

---

## 3. 共通アニメーション（party / minimal 共通）

### 3.1 マウント（初期表示）
- ページ全体：`opacity 0 → 1`（`0.25s / ease-out`）
- メイン演出コンテナ：`y 12 → 0` + `opacity 0 → 1`（`0.3s / ease-out`）
- ナビ相当要素：`delay 0.1s` でフェードイン（`0.2s / ease-out`）

### 3.2 出現順（stagger）
- 出現順：**見出し → 説明 → 入力 → ボタン**（※要素名は概念）
- `staggerChildren: 0.06`
- **同時出現は禁止**

### 3.3 CTA操作感（押した感）
- hover：`scale 1 → 1.02`（`0.15s / ease-out`）
- tap：`scale 0.98`（`0.1s`）
- partyの場合は任意で軽い回転を追加可
  - hover：`rotate: -0.4deg`
  - tap：`rotate: 0.8deg`

### 3.4 画面遷移（想定）
- 新画面：`x 16 → 0` / `opacity 0 → 1`
- 旧画面：`opacity 1 → 0`
- `duration: 0.25〜0.35` / `ease: easeOut`
- **spring**
  - `minimal`: **禁止**
  - `party`: 任意（“遊び心”として許容）

---

## 4. Party専用演出（派手解禁）

### 4.1 全画面ローディング・オーバーレイ
- `open=true` の間、全画面の固定レイヤーで表示（既存DOM非破壊）
- 表示内容（必須）
  - 進捗バー（`progress: 0..100`）
  - ステージ文言（`stageText`）
  - “流れ”インジケータ（例：解析→設計→履歴書→日記）
  - マスコット（進捗連動）

### 4.2 マスコット（進捗連動）
- mood：`idle | search | think | happy`
- 進捗→mood例
  - `progress < 35` → `search`
  - `progress < 70` → `think`
  - `progress >= 70` → `happy`
- 動き例
  - `search`: 小刻み上下＋揺れ
  - `think`: ゆっくり上下
  - `happy`: 左右スイング＋軽い回転

### 4.3 紙吹雪（任意）
- `canvas-confetti` を使用
- 発火タイミング
  - **完了時のみ**（多め）
- 連打対策：busy中は発火しない

### 4.4 動く背景（任意）
- `pointer-events:none` の固定背景レイヤー
- 大きいブロブ（rotate/y oscillation）
- 「派手」だが UI操作を邪魔しないこと（`pointer-events:none` 必須）

---

## 5. 実装I/F（ページ横断で使い回す）

```ts
export type OverlayMood = 'idle' | 'search' | 'think' | 'happy'

export type LoadingOverlayProps = {
  open: boolean
  mode: MotionMode // default: 'party'
  progress: number // 0-100
  stageText: string
  mood: OverlayMood
  steps: { label: string; threshold: number }[]
}
```

### 運用ルール
- `progress` / `stageText` は **疑似でOK**
  - 機能と分離し、アニメーションの停止/完了だけを同期させる
- 既存処理に紐づける場合も、必要なのは `open` のON/OFF（開始/終了）だけ

---

## 6. 導入手順（安全）
1. 既存処理の `start/success/error/cancel` のタイミングで `open` を切替
2. `mode` を **デフォルト `party`** で適用
3. 失敗時も `open=false` に戻す（既存のエラー/フォールバック挙動は維持）

---

## 7. 参考実装（現状）
- テストページ：`/persona/rive-test`
  - `src/app/persona/rive-test/page.tsx`
- マスコット素材：
  - `public/persona/rive-test/mascot.svg`


