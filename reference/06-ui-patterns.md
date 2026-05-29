# 06. ドヤマーケAI — UI/デザイン & サービス開発ガイド

> 新しいサービスを開発する際のデザイン指針・共通仕様・ステータス管理のすべてをまとめた包括ドキュメント。
> このドキュメントを読めば、新サービスをゼロから開発・公開できる状態を目指す。

---

## 目次

1. [ブランド基盤](#1-ブランド基盤)
2. [カラーシステム](#2-カラーシステム)
3. [タイポグラフィ](#3-タイポグラフィ)
4. [アイコン & キャラクター](#4-アイコン--キャラクター)
5. [アニメーション & エフェクト](#5-アニメーション--エフェクト)
6. [共通UIコンポーネント](#6-共通uiコンポーネント)
7. [サイドバーシステム](#7-サイドバーシステム)
8. [サービス間ナビゲーション](#8-サービス間ナビゲーション)
9. [ページレイアウトパターン](#9-ページレイアウトパターン)
10. [サービスステータス管理](#10-サービスステータス管理)
11. [全サービス一覧 & 画面遷移マップ](#11-全サービス一覧--画面遷移マップ)
12. [新サービス追加チェックリスト](#12-新サービス追加チェックリスト)
13. [課金 & アクセス制御](#13-課金--アクセス制御)
14. [デザイン方針 —「かわいい・楽しい・わかりやすい」](#14-デザイン方針-かわいい楽しいわかりやすい)
15. [共通機能 & 共通データベース管理](#15-共通機能--共通データベース管理)
16. [メール配信システム（Resend + ドリップマーケティング）](#16-メール配信システムresend--ドリップマーケティング)
17. [エラー通知 & ユーザーエラー報告システム](#17-エラー通知--ユーザーエラー報告システム)
18. [管理画面 — 統合コントロールセンター](#18-管理画面admin-統合コントロールセンター)
19. [現状の不整合・要注意事項レポート](#19-現状の不整合要注意事項レポート)

---

## 1. ブランド基盤

### コアアイデンティティ

| 項目 | 値 | 備考 |
|------|-----|------|
| プロダクト名 | ドヤマーケAI | 全サービスの総称 |
| キャッチ | AIで、ドヤれ。 | ポップ＆自信のニュアンス |
| カラー | サービスごとに個別指定 | [2.2 サービス別カラーテーマ](#22-サービス別カラーテーマ)参照 |
| 言語 | 日本語 | UI テキストは全て日本語 |
| トーン | ポップ・親しみやすい・プロ品質 | カジュアルだが信頼感 |

### ロゴ & ファビコン

| アセット | パス | 仕様 |
|---------|------|------|
| メインロゴ | `public/images/doyamarke-logo.png` | ヘッダー表示 120×40px |
| サイトアイコン | `src/app/icon.tsx` | 512×512 PNG、青ロケット + "AI" テキスト |
| Apple アイコン | `src/app/apple-icon.tsx` | Apple デバイス用 |
| OG 画像 | `public/og/portal.png` | 1200×630px、SNS シェア用 |

---

## 2. カラーシステム

### 2.1 CSS 変数（`globals.css`）

```css
:root {
  /* Primary Colors */
  --color-primary: #3B82F6;        /* Blue — メインアクション色 */
  --color-secondary: #8B5CF6;      /* Purple — ブランドアクセント */
  --color-accent: #EC4899;          /* Pink — 強調・装飾 */

  /* Gradients */
  --gradient-primary: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #EC4899 100%);
  --gradient-blue: linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%);
  --gradient-purple: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%);
  --gradient-dark: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);

  /* Shadows & Glows */
  --shadow-glow-blue: 0 0 40px rgba(59, 130, 246, 0.3);
  --shadow-glow-purple: 0 0 40px rgba(139, 92, 246, 0.3);
}
```

### 2.2 サービス別カラーテーマ

各サービスは固有のカラーテーマを持ち、サイドバーとアイコングラデーションに適用される。

| サービス ID | サービス名 | Emoji | Sidebar テーマ | グラデーション | Tailwind 配色 |
|------------|-----------|-------|---------------|--------------|--------------|
| `kantan` | カンタンマーケAI | 🚀 | — | `from-emerald-500 to-teal-500` | emerald |
| `banner` | ドヤバナーAI | 🎨 | `dashboardTheme` | `from-purple-500 to-pink-500` | purple/pink |
| `logo` | ドヤロゴ | 🏷️ | — | `from-indigo-500 to-sky-500` | indigo |
| `seo` | ドヤ記事作成 | 🧠 | `seoTheme` | `from-slate-700 to-slate-900` | slate |
| `interview` | ドヤインタビュー | 🎙️ | `interviewTheme` | `from-orange-500 to-amber-500` | orange/amber |
| `shindan` | ドヤWeb診断AI | 📊 | `shindanTheme` | `from-teal-500 to-cyan-500` | teal |
| `persona` | ドヤペルソナAI | 🎯 | `personaTheme` | `from-purple-500 to-purple-600` | purple |
| `lp` | ドヤワイヤーフレーム AI | 📄 | `lpTheme` | `from-cyan-500 to-blue-500` | cyan |
| `video` | ドヤ動画AI（台本） | 🎬 | — | `from-red-500 to-orange-500` | red |
| `tenkai` | ドヤ展開AI | 🔄 | — | `from-blue-500 to-indigo-500` | blue/indigo |
| `copy` | ドヤコピーAI | ✍️ | `copyTheme` | `from-amber-500 to-orange-500` | amber |
| `opening` | ドヤオープニングAI | 🎬 | — | `from-red-500 to-rose-600` | red/rose |
| `voice` | ドヤボイスAI | 🎙️ | `voiceTheme` | `from-violet-500 to-purple-500` | violet |
| `presentation` | ドヤプレゼンAI | 📊 | — | `from-amber-500 to-yellow-500` | amber |
| `interviewx` | ドヤヒヤリングAI | 🚀 | `interviewxTheme` | `from-indigo-500 to-violet-500` | indigo |
| `movie` | ドヤムービーAI | 🎬 | `movieTheme` | `from-rose-500 to-pink-500` | rose |
| `adsim` | ドヤ広告シミュレーションAI | 📊 | `adsimTheme` | `from-indigo-500 to-blue-600` | indigo/blue |
| `hr` | ドヤHR | 👥 | — | `from-sky-500 to-blue-600` | sky/blue |
| `kintai` | ドヤ勤怠 | ⏰ | — | `from-violet-500 to-purple-600` | violet |

### 2.3 SidebarTheme 型定義

```typescript
// src/components/sidebar/types.ts
export interface SidebarTheme {
  bgGradient: string      // サイドバー背景グラデーション
  navText: string          // ナビリンク文字色
  navTextIcon: string      // ナビアイコン色
  sectionText: string      // セクション見出し色
  toggleText: string       // 折りたたみボタン色
  toggleHover: string      // 折りたたみホバー色
  brandingText: string     // フッターブランド色
  profileBg: string        // プロフィール背景色
  avatarBg: string         // アバター背景色
  loginText: string        // ログインボタン色
  loginHover: string       // ログインホバー色
  aiBubbleBg: string       // AI吹き出し背景色
  zapColor: string         // Zapアイコン色
}
```

### 2.4 新サービス用カラーの選び方

1. 既存サービスと被らない Tailwind カラーを選ぶ
2. `from-{color}-500 to-{adjacent-color}-500` の2色グラデーションが基本
3. サイドバーテーマを作る場合は `src/components/sidebar/themes.ts` に追加
4. `ToolSwitcherMenu.tsx` の `SERVICE_ICON_MAP` にも Lucide アイコン + グラデーションを登録

**使用済みカラー**: emerald, purple, pink, indigo, sky, slate, orange, amber, teal, cyan, red, rose, violet, blue

**空きカラー候補**: lime, green, yellow, fuchsia, stone, zinc

---

## 3. タイポグラフィ

### フォント

| 用途 | フォント | Weight |
|------|---------|--------|
| 欧文（メイン） | Inter | 400–800 |
| 和文 | Noto Sans JP | 400–800 |
| 和文（セリフ系・ミツボシ用） | Noto Serif JP | — |

```css
body {
  font-family: 'Inter', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

### サイズスケール

| 用途 | クラス | 値 |
|------|--------|-----|
| ヒーロー見出し | `text-4xl sm:text-5xl lg:text-7xl` | 36–72px |
| セクション見出し | `text-3xl lg:text-5xl` | 30–48px |
| カード見出し | `text-xl font-bold` | 20px |
| 本文 | `text-base` | 16px |
| 補足テキスト | `text-sm text-slate-500` | 14px |
| バッジ/ラベル | `text-xs font-semibold` | 12px |

### テキスト装飾

```css
/* グラデーションテキスト */
.text-gradient { background-image: var(--gradient-primary); }
.text-gradient-blue { background-image: var(--gradient-blue); }
.text-gradient-purple { background-image: var(--gradient-purple); }

/* 共通パターン */
bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400
```

---

## 4. アイコン & キャラクター

### 4.1 アイコンシステム

ドヤマーケAI は 3 つのアイコンソースを使い分ける:

#### (1) Material Symbols Outlined — 構造的 UI アイコン

```html
<!-- Google Fonts CDN (layout.tsx で読み込み) -->
<span className="material-symbols-outlined text-[20px]">auto_awesome</span>
```

**主な使用箇所**: サイドバーナビ、ページヘッダー、アクションボタン

**よく使うアイコン名**:
- ナビ: `dashboard`, `search`, `image`, `record_voice_over`, `group`, `slideshow`, `business_center`
- アクション: `add`, `edit`, `delete`, `download`, `content_copy`, `arrow_back`
- 状態: `check_circle`, `error`, `info`, `notifications`
- UI: `menu`, `close`, `chevron_right`, `settings`, `logout`, `person`

#### (2) Lucide React — コンポーネント内アイコン

```tsx
import { Sparkles, ArrowRight, Plus } from 'lucide-react'
<Sparkles className="w-5 h-5" />
```

**主な使用箇所**: ボタン内、カード内、ToolSwitcherMenu

**サービス別アイコンマッピング** (`ToolSwitcherMenu.tsx`):

| サービス ID | Lucide アイコン |
|------------|---------------|
| `kantan` | `Sparkles` |
| `banner` | `Image` |
| `seo` | `FileText` |
| `interview` | `Mic` |
| `opening` | `Play` |
| `persona` | `Target` |
| `voice` | `Volume2` |
| `lp` | `LayoutGrid` |
| `copy` | `PenLine` |
| `movie` | `Film` |
| `interviewx` | `Send` |
| `adsim` | `BarChart3` |
| `hr` | `Users` |

#### (3) Emoji — サービスアイデンティティ

各サービスの `services.ts` で定義された Emoji は、ダッシュボードカード・ランディングページ・料金表で使用:

| 種別 | Emoji 例 |
|------|---------|
| サービス識別 | 🎨 🧠 🎙️ ✍️ 📄 🎬 📊 🎯 👥 ⏰ 🔄 🚀 🏷️ |
| 装飾 | ✨（プレミアム）🚀（ローンチ）💡（アイデア）💰（料金） |

### 4.2 公式キャラクターシステム — ドヤくん（SaaSキャラクター）

#### キャラクター設定

**正式名称**: **ドヤくん**（ドヤマーケAI 公式マスコット）

**ビジュアル設計**:

| 要素 | 仕様 |
|------|------|
| 種族 | シロクマ（白い体毛） |
| 服装 | 白いパーカー（フード付き、コードシンボル装飾あり） |
| アクセサリー | **青色のVRゴーグル**（トレードマーク） |
| 表情ベース | 大きな目・口角の上がった親しみやすい顔 |
| 体型 | 丸みのあるかわいいシルエット |
| カラーパレット | 白 + 青系（VRゴーグル・コード・装飾） |

**世界観**:
- テック × AI × クリエイティブ
- 背景はハーフトーンドット + コード `</>` シンボル + 雲 + 歯車などのモチーフ
- 青系のアクセントカラーで統一（VRゴーグルと同色）
- サイバーパンクすぎず、ポップで親しみやすいトーン

**ブランド意味**:
- VRゴーグル = 「AIの未来を見据えている」
- シロクマ = 「清潔感・信頼・かわいさ」
- パーカー = 「カジュアルで親しみやすい」
- コードシンボル = 「テック・開発者目線」

**マスターアセット原本**: `Google Drive > 01_事業管理 > 15_Saasは死にましぇん > 00_キャラクターボード/`

**プロジェクト内アセット**: `public/character/{mood}.png`

#### 15 種類のムード画像（公式バリエーション）

| ムード | ファイル | 表現 | 使用場面 | デフォルト台詞 |
|--------|---------|------|---------|--------------|
| `hello` | `hello.png` | 手を振って挨拶 | 初回表示・歓迎 | やあ！一緒にがんばろう！ |
| `point` | `point.png` | 指差して解説 | ヒント・ガイダンス | ここがポイントだよ！ |
| `success` | `success.png` | ガッツポーズ + トロフィー | 完了・成功 | やったー！すごい！ |
| `working` | `working.png` | ノートPCで作業中 | 処理中・生成中 | もくもく作業中... |
| `thinking` | `thinking.png` | 顎に手を当てて考え中 | 分析中・判断中 | うーん、考え中... |
| `jump` | `jump.png` | 飛び上がって大喜び | 大成功・特別な達成 | 最高！！テンション上がる！ |
| `thumbsup` | `thumbsup.png` | サムズアップ | 確認・承認 | いいね！その調子！ |
| `surprise` | `surprise.png` | 目を見開いて驚き | 新発見・通知 | おっ！新しい発見！ |
| `love` | `love.png` | ハートマーク + 大好きポーズ | お気に入り・好評 | このプロジェクト大好き！ |
| `ramen` | `ramen.png` | ラーメンを食べて休憩 | 休憩・待機 | 休憩も大事だよ〜 |
| `sleep` | `sleep.png` | うとうと居眠り | アイドル状態 | zzz...おやすみ... |
| `focus` | `focus.png` | 集中モード | 集中作業中 | 集中！集中！ |
| `present` | `present.png` | プレゼン中 | プレゼン・結果表示 | プレゼンの時間だ！ |
| `error` | `error.png` | 涙目で泣いている | エラー発生 | うぅ...エラーだ... |
| `bug` | `bug.png` | 怒り顔（バグを見つけた） | バグ・問題検出 | バグ見つけた！許さない！ |

#### コンポーネント実装

```tsx
import { Character, CharacterOnly } from '@/components/promane/character'

// 吹き出し付きキャラクター
<Character mood="success" size={80} animate="float" />

// キャラクターのみ
<CharacterOnly mood="working" size={64} animate="bounce-in" />
```

**アニメーション**: `float`（ふわふわ上下）、`bounce-in`（バウンド登場）、`wiggle`（揺れ）、`none`

#### キャラクターレギュレーション

**やっていいこと**:
- ✅ サイズ変更（ただし縦横比は維持）
- ✅ 影や drop-shadow の追加
- ✅ float / bounce-in / wiggle アニメーション
- ✅ 吹き出し（白背景・グレー枠）と組み合わせる

**やってはいけないこと**:
- 🚫 色の改変（VRゴーグルの青を変えない、体の白を変えない）
- 🚫 キャラクターを反転・回転
- 🚫 キャラクターの上にテキスト・要素を重ねる
- 🚫 別キャラクターを混在させる（1画面1キャラ）
- 🚫 過度に小さく表示（最低 48px 以上を推奨）

#### サービス別の派生キャラクター

同じドヤくんの世界観をベースに、サービス別の派生バリエーションも展開可能:

| サービス | 派生先 | 用途 |
|---------|--------|------|
| ドヤ勤怠 | `public/kintai/characters/` | 勤怠管理（同じ15ムード体系、ファイル名は `{mood}_{日本語}.png`） |
| ドヤHR | `public/hr/characters/` | HR管理（同じ15ムード体系） |
| 慰めAI（ミツボシ） | `public/mitsuboshi/personas/` | 22ペルソナ別キャラ |

新サービスでキャラを派生させる場合も、**VRゴーグル + パーカー + 青系アクセント**の基本デザインは維持する。

### 4.3 新サービスでのキャラクター活用ガイド

| 場面 | 推奨ムード | 演出 |
|------|-----------|------|
| 初回ダッシュボード | `hello` | 歓迎メッセージ |
| AI 生成中 | `working` or `thinking` | ローディング画面 |
| 生成完了 | `success` or `jump` | 結果表示画面 |
| エラー発生 | `error` | エラー画面 |
| 上限到達 | `ramen` | アップセルモーダル |
| PRO 昇格 | `jump` | お祝いアニメーション |

---

## 5. アニメーション & エフェクト

### 5.1 CSS アニメーション（`globals.css`）

| クラス | 効果 | 用途 |
|--------|------|------|
| `animate-fade-in` | opacity 0→1 (0.5s) | ページ表示 |
| `animate-fade-in-up` | Y+20→0 + opacity (0.5s) | カード登場 |
| `animate-fade-in-down` | Y-20→0 + opacity (0.5s) | ドロップダウン |
| `animate-scale-in` | scale 0.95→1 (0.3s) | モーダル |
| `animate-slide-in-right` | X+20→0 (0.5s) | サイドパネル・吹き出し |
| `animate-float` | Y ±10px (3s infinite) | キャラクター |
| `animate-pulse-glow` | グロー明滅 (2s infinite) | CTA ボタン |
| `animate-shimmer` | 光沢スイープ (1.5s infinite) | スケルトン |
| `animate-bounce-subtle` | Y ±4px (2s infinite) | アイコン |
| `animate-spin-slow` | 回転 (3s infinite) | ローディング |

**ディレイユーティリティ**: `animation-delay-{100,200,300,400,500}`

### 5.2 Framer Motion パターン

```tsx
import { motion, AnimatePresence } from 'framer-motion'

// ページ登場
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.2 }}
/>

// モーダル
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl"
      />
    </motion.div>
  )}
</AnimatePresence>

// サイドバーアクティブインジケーター
<motion.div
  layoutId="activeIndicator"
  className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full"
/>
```

### 5.3 エフェクトクラス

| クラス | 効果 |
|--------|------|
| `.glass` | `bg-white/5 backdrop-blur-xl border-white/10` |
| `.glass-dark` | `bg-slate-900/50 backdrop-blur-xl border-slate-700/50` |
| `.glow-blue` | 青グロー |
| `.glow-purple` | 紫グロー |
| `.hover-scale` | hover 時 1.02 倍 |
| `.bg-grid` | グリッドパターン背景 |
| `.bg-dots` | ドットパターン背景 |

---

## 6. 共通 UI コンポーネント

### 6.1 ボタン

```css
/* Primary — メイン CTA */
.btn-primary {
  background: var(--gradient-primary);  /* Blue→Purple→Pink */
  box-shadow: var(--shadow-md), var(--shadow-glow-blue);
  /* hover: translateY(-2px) + shadow-lg */
}

/* Secondary — サブアクション */
.btn-secondary {
  bg-white/10 backdrop-blur border-white/20
}

/* Ghost — テキストリンク風 */
.btn-ghost {
  text-slate-300 hover:text-white hover:bg-white/10
}
```

**共通ボタンプロパティ**: `rounded-xl`, `px-6 py-3`, `font-semibold`, `transition-all duration-200`

### 6.2 カード

```css
/* Standard Card */
.card {
  bg-white rounded-2xl border-slate-200 shadow-sm
  hover: shadow-lg border-slate-300 translateY(-2px)
}

/* Dark Card */
.card-dark {
  bg-slate-800/50 backdrop-blur-xl border-slate-700/50
}
```

**サービスカード構造**:
```
┌─────────────────────┐
│ Emoji  サービス名     │  ← text-2xl + text-lg font-bold
│                       │
│ 説明テキスト           │  ← text-sm text-slate-500
│                       │
│ [機能タグ] [機能タグ]  │  ← badge 群
│                       │
│ [使ってみる →]         │  ← btn-primary or gradient link
└─────────────────────┘
```

### 6.3 バッジ

```css
.badge-primary  { bg-blue-500/10 text-blue-400 border-blue-500/20 }
.badge-success  { bg-emerald-500/10 text-emerald-400 }
.badge-warning  { bg-amber-500/10 text-amber-400 }
.badge-new      { bg-gradient-to-r from-emerald-500 to-teal-500 text-white }
```

### 6.4 インプット

```css
.input {
  px-4 py-3 rounded-xl border-2 border-slate-200
  focus: border-blue-500 ring-4 ring-blue-500/20
  placeholder: text-slate-400
}
```

### 6.5 モーダル

```tsx
<AnimatePresence>
  <motion.div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm">
    <motion.div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
      {/* コンテンツ */}
    </motion.div>
  </motion.div>
</AnimatePresence>
```

### 6.6 トースト通知

```tsx
import toast from 'react-hot-toast'
toast.success('保存しました')
toast.error('エラーが発生しました')
```

### 6.7 共通コンポーネント一覧

| コンポーネント | パス | 説明 |
|-------------|------|------|
| `Providers` | `src/components/` | NextAuth SessionProvider |
| `GoogleTagManager` | `src/components/` | GTM 埋め込み |
| `ToolSwitcherMenu` | `src/components/` | サイドバーツール切り替え |
| `CheckoutButton` | `src/components/` | Stripe 決済ボタン |
| `FreeHourPopup` | `src/components/` | 1時間生成し放題ポップアップ |
| `OnboardingModal` | `src/components/` | 初回案内モーダル |
| `UsageLimitBanner` | `src/components/` | 利用制限バナー |
| `UpgradeSuccessModal` | `src/components/` | アップグレード成功 |
| `LoadingProgress` | `src/components/` | ローディング |
| `LogoutToastListener` | `src/components/` | ログアウト通知 |
| `PlanUpdatedListener` | `src/components/` | プラン更新通知 |
| `Character` / `CharacterOnly` | `src/components/promane/` | マスコットキャラクター |

---

## 7. サイドバーシステム

### 7.1 構造

```
┌─────────────────────┐
│ ロゴ + サービス名      │  ← SidebarLogoSection
├─────────────────────┤
│ ナビゲーション項目      │  ← SidebarNavLink × N
│ ├─ メイン機能 (HOT)   │     badge / hot 表示対応
│ ├─ 履歴/一覧         │
│ └─ 設定/プラン        │
├─────────────────────┤
│ ツール切り替えメニュー   │  ← ToolSwitcherMenu
│ (他サービスへのリンク)   │     active なサービスのみ表示
├─────────────────────┤
│ プラン案内バナー        │  ← SidebarFreeHourBanner
│ (1時間無料 / PRO案内)  │
├─────────────────────┤
│ ユーザー情報           │  ← SidebarUserProfile
│ ├─ ログイン/ログアウト  │     SidebarLogoutDialog
│ └─ ヘルプリンク        │     SidebarHelpContact
└─────────────────────┘
```

### 7.2 共通コンポーネント（`src/components/sidebar/`）

| ファイル | 説明 |
|---------|------|
| `types.ts` | `SidebarTheme`, `NavItem`, `SidebarProps` 型定義 |
| `themes.ts` | 11 テーマプリセット（上記カラーテーマ表参照） |
| `useSidebarState.ts` | 折りたたみ状態管理（controlled + uncontrolled） |
| `useFreeHour.ts` | 1 時間生成し放題タイマー + `formatRemainingTime` |
| `SidebarShell.tsx` | `motion.aside` ラッパー（幅: 72px ↔ 240px） |
| `SidebarNavLink.tsx` | ナビリンク（テーマ色・HOT/badge・`data-tour-nav`） |
| `SidebarSectionTitle.tsx` | セクション見出し |
| `SidebarCollapseToggle.tsx` | 折りたたみボタン |
| `SidebarBrandingFooter.tsx` | フッターブランド名 |
| `SidebarHelpContact.tsx` | お問い合わせボタン |
| `SidebarLogoSection.tsx` | ロゴ + サービス名（サブタイトル対応） |
| `SidebarUserProfile.tsx` | ユーザー情報（設定リンク・ログイン/ログアウト・renderExtra） |
| `SidebarLogoutDialog.tsx` | ログアウト確認ダイアログ |
| `SidebarFreeHourBanner.tsx` | 生成し放題バナー（コンパクト版） |

### 7.3 サイドバー機能

- **折りたたみ**: PC は展開/折りたたみ切り替え（72px ↔ 240px アニメーション）
- **モバイル**: 常に展開表示
- **アクティブ表示**: `layoutId` による Framer Motion アニメーション
- **1 時間生成し放題**: 残り時間リアルタイム表示（1 秒更新）

### 7.4 既存サイドバーテーマと対応サービス

| テーマ | サービス | 配色 |
|--------|---------|------|
| `dashboardTheme` | Banner, ダッシュボード | Blue `#2563EB` |
| `seoTheme` | SEO 記事作成 | Emerald→Green→Teal |
| `interviewTheme` | インタビュー | Brand Purple `#7f19e6` |
| `copyTheme` | コピー | Amber→Orange |
| `lpTheme` | ワイヤーフレーム | Cyan Dark |
| `personaTheme` | ペルソナ | Purple |
| `shindanTheme` | Web 診断 | Teal |
| `voiceTheme` | ボイス | Violet Dark |
| `movieTheme` | ムービー | Rose Dark |
| `adsimTheme` | 広告シミュレーション | Digital Blue `#000060` |
| `interviewxTheme` | ヒヤリング | Indigo→Violet |

---

## 8. サービス間ナビゲーション

### 8.1 ToolSwitcherMenu

**場所**: `src/components/ToolSwitcherMenu.tsx`

**機能**:
- サイドバー内に常時表示される「他のツールを使う」ボタン
- `getActiveServices()` で `status === 'active'` なサービスのみ動的表示
- 各サービスにLucideアイコン + グラデーション背景
- ビューポート位置に応じて上/下展開を自動判定
- 現在のサービスはハイライト表示（非リンク）

**表示条件**: ステータスが `active` のサービスのみ表示

```typescript
// services.ts — ステータスが 'active' のサービスだけ表示される
export function getActiveServices(): Service[] {
  return SERVICES.filter(s => s.status === 'active').sort((a, b) => a.order - b.order)
}
```

### 8.2 画面遷移フロー

```
ランディングページ (/)
  ↓ ログイン
ダッシュボード (/dashboard)  ← 全サービス一覧カード
  ↓ サービス選択
各サービストップ (/{service})
  ├─ 新規作成 (/{service}/new)
  ├─ プロジェクト詳細 (/{service}/[projectId])
  ├─ 履歴 (/{service}/history)
  ├─ 料金 (/{service}/pricing)
  └─ ToolSwitcherMenu → 別サービスへ遷移
```

### 8.3 新サービス追加時の遷移への影響

| 変更箇所 | 影響 | 必要作業 |
|---------|------|---------|
| `services.ts` に追加 | ダッシュボードカードに表示 | Service オブジェクト追加 |
| `status: 'active'` に変更 | ToolSwitcherMenu に表示 | ステータス変更のみ |
| `ToolSwitcherMenu.tsx` | Lucide アイコン表示 | `SERVICE_ICON_MAP` に追加 |
| `themes.ts` | サイドバー配色 | テーマ追加（任意） |
| サイドバーコンポーネント | ナビゲーション | 専用サイドバー作成 |

---

## 9. ページレイアウトパターン

### 9.1 ルートレイアウト (`src/app/layout.tsx`)

```
<html>
  <body>
    <Providers>           ← NextAuth SessionProvider
      <GoogleTagManager /> ← GTM
      <LogoutToastListener />
      <PlanUpdatedListener />
      {children}
    </Providers>
  </body>
</html>
```

### 9.2 サービスレイアウト標準パターン

```tsx
// src/app/{service}/layout.tsx
'use client'

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <ServiceSidebar />          {/* サービス固有サイドバー */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
```

### 9.3 サービスダッシュボード標準パターン

```tsx
// src/app/{service}/page.tsx
'use client'

export default function ServiceDashboard() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* ヘッダー: Emoji + サービス名 + 説明 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <span>🎨</span> ドヤバナーAI
        </h1>
        <p className="text-slate-500 mt-1">説明テキスト</p>
      </div>

      {/* プロジェクト一覧 or 作成フォーム */}
      <div className="grid gap-4">
        {/* カード一覧 */}
      </div>
    </div>
  )
}
```

### 9.4 既存サービスのレイアウト対応表

| サービス | layout.tsx | サイドバー |
|---------|-----------|----------|
| Banner | `DashboardLayout` | `DashboardSidebar` |
| SEO | `SeoAppLayout` | `SeoSidebar` |
| Interview | `InterviewLayout` | `InterviewSidebar` |
| Copy | 専用 layout | `CopySidebar` |
| LP | 専用 layout | `LpSidebar` |
| Persona | `PersonaAppLayout` | `PersonaSidebar` |
| Shindan | `ShindanAppLayout` | `ShindanSidebar` |
| Voice | 専用 layout | 専用 Sidebar |
| Movie | 専用 layout | 専用 Sidebar |
| AdSim | 専用 layout | `AdSimSidebar` |
| Tenkai | `TenkaiLayout` | `TenkaiSidebar` |
| InterviewX | 専用 layout | 専用 Sidebar |
| HR | 専用 layout | 専用 Sidebar |
| Kintai | 専用 layout | 専用 Sidebar |
| Admin | 専用 layout | `AdminSidebar` |

---

## 10. サービスステータス管理

### 10.1 ステータス定義

```typescript
// src/lib/services.ts
export type ServiceStatus = 'active' | 'beta' | 'coming_soon' | 'maintenance'
```

| ステータス | 意味 | ToolSwitcher 表示 | ダッシュボード表示 | アクセス |
|-----------|------|------------------|-----------------|---------|
| `active` | 本番稼働中 | ✅ 表示 | ✅ 通常カード | 利用可能 |
| `beta` | テスト公開中 | ✅ 表示 | ✅ β バッジ付き | 利用可能 |
| `coming_soon` | 開発中/公開前 | ❌ 非表示 | ✅ 「近日公開」バッジ | アクセス不可 |
| `maintenance` | メンテナンス中 | ❌ 非表示 | ⚠️ メンテナンスバッジ | アクセス不可 |

### 10.2 ステータス変更の影響範囲

#### `coming_soon` → `active` に変更する場合

1. **`src/lib/services.ts`**: `status: 'active'` に変更
2. **自動反映される箇所**:
   - ToolSwitcherMenu に表示される（`getActiveServices()` が拾う）
   - ダッシュボードのカード表示が通常リンクになる
3. **手動確認が必要な箇所**:
   - `reference/10-service-status.md` を更新
   - ランディングページの料金表に反映されているか確認
   - Stripe Price ID が環境変数に設定されているか確認

#### `maintenance` → `active` に復帰する場合

上記に加えて:
- 機能が正常に動作するか E2E テスト
- DB マイグレーションが最新か確認

### 10.3 `services.ts` Service インターフェース（完全版）

```typescript
export interface Service {
  // === 基本情報 ===
  id: string              // URL パスの識別子 (例: 'banner')
  name: string            // 正式名称 (例: 'ドヤバナーAI')
  shortName?: string      // 短縮名 (例: 'バナー') — タブ・サイドバー用
  description: string     // 1行説明
  longDescription?: string // 詳細説明

  // === デザイン ===
  icon: string            // Emoji アイコン
  color: string           // Tailwind カラー名 (例: 'purple')
  gradient: string        // グラデーション (例: 'from-purple-500 to-pink-500')
  bgGradient?: string     // 背景グラデーション

  // === ナビゲーション ===
  href: string            // サービストップ URL
  dashboardHref: string   // ダッシュボード URL
  pricingHref: string     // 料金ページ URL
  guideHref: string       // ガイドページ URL

  // === 機能説明 ===
  features: string[]      // 機能リスト（料金表等で使用）
  useCases?: string[]     // ユースケース

  // === 料金 ===
  pricing: {
    free: ServicePricing
    light?: ServicePricing
    pro: ServicePricing
    enterprise?: ServicePricing
  }

  // === 状態 ===
  status: ServiceStatus   // 'active' | 'beta' | 'coming_soon' | 'maintenance'
  category: ServiceCategory // 'text' | 'image' | 'video' | 'web' | 'other'
  order: number           // 表示順

  // === 追加設定 ===
  requiresAuth: boolean   // ゲスト利用可否
  isNew?: boolean         // NEW バッジ表示
  badge?: string          // カスタムバッジ (例: '近日公開', 'NEW', '開発中')
}
```

---

## 11. 全サービス一覧 & 画面遷移マップ

### 11.1 サービス実装マトリクス

| # | サービス名 | ID | パス | ステータス | ページ | API | DB モデル | Sidebar テーマ | ドキュメント |
|---|-----------|----|----|----------|-------|-----|---------|--------------|------------|
| 1 | カンタンマーケAI | `kantan` | `/kantan` | maintenance | 10頁 | ❌ | ⚠️ | — | ✅ |
| 2 | ドヤバナーAI | `banner` | `/banner` | **active** | 16頁 | 17件 | 1 | dashboard | ✅ |
| 3 | ドヤロゴ | `logo` | `/logo` | maintenance | ✅ | 1件 | ⚠️ | — | ✅ |
| 4 | ドヤ記事作成（SEO） | `seo` | `/seo` | **active** | 45頁 | 54件 | 12 | seo | ✅ |
| 5 | ドヤインタビュー | `interview` | `/interview` | **active** | 15頁 | 21件 | 7 | interview | ✅ |
| 6 | ドヤWeb診断AI | `shindan` | `/shindan` | maintenance | 3頁 | ❌ | ❌ | shindan | ✅ |
| 7 | ドヤペルソナAI | `persona` | `/persona` | **active** | 5頁 | 3件 | ⚠️ | persona | ✅ |
| 8 | ドヤワイヤーフレーム AI | `lp` | `/lp` | **active** | 9頁 | 9件 | 2 | lp | ✅ |
| 9 | ドヤ展開AI | `tenkai` | `/tenkai` | coming_soon | 10頁 | 23件 | 6 | — | ✅ |
| 10 | ドヤコピーAI | `copy` | `/copy` | **active** | 12頁 | 11件 | 3 | copy | ✅ |
| 11 | ドヤオープニングAI | `opening` | `/opening` | maintenance | ✅ | 5件 | 2 | — | ❌ |
| 12 | ドヤボイスAI | `voice` | `/voice` | **active** | 10頁 | 12件 | 2 | voice | ❌ |
| 13 | ドヤプレゼンAI | `presentation` | `/presentation` | coming_soon | ❌ | ❌ | ❌ | — | ❌ |
| 14 | ドヤヒヤリングAI | `interviewx` | `/interviewx` | coming_soon | ✅ | ✅ | ✅ | interviewx | ❌ |
| 15 | ドヤムービーAI | `movie` | `/movie` | **active** | 11頁 | 15件 | 3 | movie | ❌ |
| 16 | ドヤ広告シミュレーションAI | `adsim` | `/adsim` | coming_soon | 6頁 | 9件 | 1 | adsim | ✅ |
| 17 | ドヤHR | `hr` | `/hr` | coming_soon | 14頁 | 30件 | 10 | — | ❌ |
| 18 | ドヤ勤怠 | `kintai` | `/kintai` | **active** | ✅ | ✅ | ✅ | — | ❌ |
| 19 | ドヤ動画AI（台本） | `video` | `/video` | coming_soon | ❌ | ❌ | ❌ | — | ❌ |
| 20 | 管理画面 | — | `/admin` | **active** | 15頁 | 16件+ | 3 | — | ❌ |

### 11.2 サービス別 画面遷移パターン

各サービスは以下の共通画面パターンを持つ。新サービス作成時はこのパターンに従う:

#### パターン A: プロジェクト型（SEO, Interview, Copy, LP, AdSim, Tenkai, Movie）

```
/{service}/                    ← ダッシュボード（プロジェクト一覧）
/{service}/new                 ← 新規作成（ウィザード/フォーム）
/{service}/[projectId]         ← プロジェクト詳細・結果表示
/{service}/[projectId]/edit    ← 編集（任意）
/{service}/history             ← 履歴一覧
/{service}/pricing             ← 料金プラン
/{service}/guide               ← 使い方ガイド
/{service}/templates           ← テンプレート選択（任意）
/{service}/settings            ← サービス固有設定（任意）
```

#### パターン B: ワンショット型（Banner, Persona, Voice, Opening）

```
/{service}/                    ← メイン画面（入力 → 生成 → 結果）
/{service}/dashboard           ← ダッシュボード/ギャラリー
/{service}/history             ← 生成履歴
/{service}/pricing             ← 料金プラン
/{service}/guide               ← 使い方ガイド
```

#### パターン C: 管理ツール型（HR, Kintai）

```
/{service}/                    ← トップ/リダイレクト
/{service}/dashboard           ← ダッシュボード
/{service}/employees           ← 従業員一覧
/{service}/[employeeId]        ← 個人詳細
/{service}/settings            ← 設定
/{service}/reports             ← レポート
/{service}/pricing             ← 料金プラン
```

### 11.3 共通画面フロー（ステータス遷移による影響）

```
【ステータス: coming_soon】
LP表示 → "近日公開" バッジ → メール登録のみ

【ステータス: active への切り替え時】
┌──────────────────────────────────────────────────┐
│ 1. services.ts の status を 'active' に変更        │
│ 2. → ToolSwitcherMenu に自動表示                   │
│ 3. → ダッシュボードカードがリンクに変化              │
│ 4. → サイドバーナビに項目追加                       │
│ 5. → ランディングページのサービス一覧に表示           │
│ 6. → 料金表に表示                                  │
└──────────────────────────────────────────────────┘

【ステータス: maintenance への変更時】
┌──────────────────────────────────────────────────┐
│ 1. services.ts の status を 'maintenance' に変更   │
│ 2. → ToolSwitcherMenu から自動消去                 │
│ 3. → ダッシュボードカードに「メンテナンス中」表示    │
│ 4. → 直接 URL アクセスはメンテナンスページへ         │
└──────────────────────────────────────────────────┘
```

---

## 12. 新サービス追加チェックリスト

### Phase 1: 定義（最初にやること）

- [ ] **`src/lib/services.ts`** に Service オブジェクトを追加
  - `id`: URL パス名と一致させる
  - `status: 'coming_soon'` で開始
  - `icon`: 他と被らない Emoji を選定
  - `gradient`: 他と被らないカラーを選定（[2.4 空きカラー](#24-新サービス用カラーの選び方)参照）
  - `order`: 表示順（既存の order を確認して空き番号を使う）
  - `pricing`: free / light / pro / enterprise の料金設定
  - `features`: 5–8 個の機能リスト
- [ ] **`reference/services/{service-id}.md`** にサービス仕様ドキュメントを作成

### Phase 2: UI 実装

- [ ] **ページ作成**
  - `src/app/{service}/page.tsx` — ダッシュボード/メイン画面
  - `src/app/{service}/layout.tsx` — サイドバー付きレイアウト
  - 画面パターン A/B/C のどれに当てはまるか決定して必要ページを作成
- [ ] **サイドバー作成**
  - 既存テーマで足りなければ `src/components/sidebar/themes.ts` にテーマ追加
  - サービス専用サイドバーコンポーネントを作成（共通コンポーネント活用）
  - `ToolSwitcherMenu` を必ず含める
- [ ] **キャラクター活用**
  - ダッシュボード初回表示: `Character mood="hello"`
  - ローディング: `Character mood="working"`
  - 成功: `Character mood="success"`
  - エラー: `Character mood="error"`

### Phase 3: API 実装

- [ ] **API ルート作成** (`src/app/api/{service}/`)
  ```typescript
  export const runtime = 'nodejs'
  export const dynamic = 'force-dynamic'
  export const maxDuration = 300
  ```
- [ ] **Prisma モデル追加**（必要な場合）
  - `prisma/schema.prisma` にモデル追加
  - `npx prisma generate` 実行
  - `@@map("{service}_xxx")` でテーブルプレフィックスを付ける
- [ ] **画像生成が必要な場合**
  - `generateImageWithFallback()` を使用（直接 API 呼び出し禁止）

### Phase 4: ナビゲーション統合

- [ ] **`src/components/ToolSwitcherMenu.tsx`** の `SERVICE_ICON_MAP` に追加
  - Lucide アイコン + `iconBg` グラデーションを設定
- [ ] **ダッシュボード**
  - `services.ts` に追加済みなら自動でカード表示される

### Phase 5: 公開

- [ ] **ステータスを `active` に変更** (`services.ts`)
- [ ] **Stripe Price ID** を `.env` と Vercel 環境変数に設定
- [ ] **`reference/10-service-status.md`** を更新
- [ ] **ランディングページ** のサービス一覧・料金表を確認
- [ ] **本番デプロイ**: `git push origin main`

### 既存サービスを壊さないための安全ルール

新サービスの開発・改修時に、稼働中の他サービスを壊すことは**絶対に避ける**。以下を必ず守ること。

#### 触っていいファイル / 触ってはいけないファイル

```
✅ 自由に編集できる（新サービスのスコープ内）:
  src/app/{新サービス}/        ← 新サービス専用ページ
  src/app/api/{新サービス}/    ← 新サービス専用 API
  src/components/{新サービス}/ ← 新サービス専用コンポーネント
  src/lib/{新サービス}/        ← 新サービス専用ロジック

⚠️ 変更前に影響範囲を必ず確認する（共通ファイル）:
  src/lib/services.ts          ← 全サービスの定義。追加は OK、既存の変更は慎重に
  src/lib/pricing.ts           ← 課金ロジック。既存サービスの料金設定を変えない
  src/lib/stripe.ts            ← Stripe 統合。既存 Price ID を壊さない
  src/lib/auth.ts              ← 認証。変更すると全サービスが 500 エラーになる
  src/lib/prisma.ts            ← DB クライアント。変更禁止に近い
  src/components/sidebar/      ← 共通サイドバー。既存テーマを変更しない
  src/components/ToolSwitcherMenu.tsx ← 追加は OK、既存マッピングを消さない
  src/app/layout.tsx           ← ルートレイアウト。変更すると全ページに影響
  prisma/schema.prisma         ← モデル追加は OK、既存モデルのカラム変更は慎重に
  middleware.ts                ← 変更すると全ルーティングに影響

🚫 絶対に触らない（他サービスの専用ファイル）:
  src/app/{他サービス}/        ← 関係ないサービスのページ
  src/app/api/{他サービス}/    ← 関係ないサービスの API
  src/components/{他サービス}/ ← 関係ないサービスのコンポーネント
  src/lib/{他サービス}/        ← 関係ないサービスのロジック
```

#### 共通ファイルを変更する場合のチェック手順

1. **変更前に `git diff` で差分を確認** — 変更が新サービスのスコープ内に収まっているか
2. **`npx next build` でビルド確認** — 型エラーやインポートエラーが出ていないか
3. **既存サービスの画面を目視確認** — 特にダッシュボード、サイドバー、ToolSwitcherMenu が正常に表示されるか
4. **認証フローの確認** — ログイン・ログアウトが正常に動作するか（`auth.ts` を触った場合は必須）
5. **課金フローの確認** — Stripe Checkout が正常に動作するか（`stripe.ts` / `pricing.ts` を触った場合は必須）

#### Prisma スキーマ変更時の注意

```
✅ 安全な変更（追加のみ）:
  - 新しい model の追加
  - 既存 model への nullable カラム追加（String?）
  - 新しい enum 値の追加

⚠️ 危険な変更（データ破壊の可能性）:
  - 既存カラムの型変更
  - 既存カラムの削除
  - NOT NULL 制約の追加（既存データが null の場合に失敗）
  - @@unique / @@index の変更
  - @@map 名の変更（テーブル名が変わる）

手順:
  1. prisma/schema.prisma を編集
  2. npx prisma generate（型生成のみ、DB には反映しない）
  3. npx next build で型エラーがないか確認
  4. npx prisma db push（本番 DB に反映）← 破壊的変更がある場合は事前に相談
```

#### やってはいけないこと

- **NextAuth ハンドラー（`api/auth/[...nextauth]/route.ts`）の改変** → 全サービスが 500 エラーになる
- **`layout.tsx`（ルート）の Provider 順序変更** → 全ページが壊れる
- **既存サービスの `services.ts` エントリの `id` 変更** → URL が変わり既存リンクが死ぬ
- **Stripe の `STRIPE_PRICE_IDS` から既存エントリを削除** → 既存ユーザーのプラン判定が壊れる
- **`package.json` から既存パッケージの削除** → 依存しているサービスが壊れる
- **並行開発時に他のエージェントが編集中のファイルを同時編集** → コンフリクトでファイル消失の実績あり

---

## 13. 課金 & アクセス制御 — 完全仕様

### 13.1 統一プラン方式

**大原則**: ドヤマーケAI は **統一プラン方式** を採用。1 つのサブスクリプションに課金すれば、**全サービスの PRO プランが利用可能**。サービスごとに個別課金しない。

```typescript
// src/lib/stripe.ts
type ServiceId = 'seo' | 'banner' | 'interview' | 'copy' | 'lp' |
                 'voice' | 'movie' | 'adsim' | 'hr' | 'bundle'

type PlanId =
  'seo-light' | 'seo-pro' | 'seo-enterprise' |
  'banner-light' | 'banner-pro' | 'banner-enterprise' |
  'interview-light' | 'interview-pro' | 'interview-enterprise' |
  'copy-light' | 'copy-pro' | 'copy-enterprise' |
  'lp-light' | 'lp-pro' | 'lp-enterprise' |
  'voice-light' | 'voice-pro' | 'voice-enterprise' |
  'movie-light' | 'movie-pro' | 'movie-enterprise' |
  'adsim-light' | 'adsim-pro' | 'adsim-enterprise' |
  'hr-starter' | 'hr-pro' | 'hr-enterprise' |
  'bundle'
```

#### Stripe 共通プランの仕組み（統一課金アーキテクチャ）

**コア設計**: Stripe 上の「商品」はドヤバナーAI の Price ID を基準とし、全サービスが同じ Price ID にフォールバックする。ユーザーがどのサービスから課金しても、結果的に同一の Stripe サブスクリプションが作成され、全サービスの PRO が解放される。

```
ユーザーが「ドヤ記事作成 PRO」に課金
  ↓
Stripe Price ID を解決:
  STRIPE_PRICE_SEO_PRO_MONTHLY が設定されていれば → それを使用
  設定されていなければ → BANNER_PRO_MONTHLY にフォールバック
  ↓
結果: バナーAI と同じ Price ID で課金 = 同一サブスクリプション
  ↓
Webhook で user.plan = 'PRO' に更新
  ↓
全サービスの PRO 機能が解放
```

**Price ID フォールバックチェーン** (`src/lib/stripe.ts`):

```typescript
// 基準価格（ドヤバナーAI）
const BANNER_LIGHT_MONTHLY = process.env.STRIPE_PRICE_BANNER_LIGHT_MONTHLY
const BANNER_PRO_MONTHLY   = process.env.STRIPE_PRICE_BANNER_PRO_MONTHLY
const BANNER_ENTERPRISE_MONTHLY = process.env.STRIPE_PRICE_BANNER_ENTERPRISE_MONTHLY

// 他サービスはバナーにフォールバック
STRIPE_PRICE_IDS = {
  seo:       { light: { monthly: env.SEO_LIGHT   || BANNER_LIGHT_MONTHLY } },
  copy:      { light: { monthly: env.COPY_LIGHT  || BANNER_LIGHT_MONTHLY } },
  interview: { light: { monthly: env.INTERVIEW_LIGHT || BANNER_LIGHT_MONTHLY } },
  lp:        { light: { monthly: env.LP_LIGHT    || BANNER_LIGHT_MONTHLY } },
  voice:     { light: { monthly: env.VOICE_LIGHT || BANNER_LIGHT_MONTHLY } },
  movie:     { light: { monthly: env.MOVIE_LIGHT || BANNER_LIGHT_MONTHLY } },
  adsim:     { light: { monthly: env.ADSIM_LIGHT || BANNER_LIGHT_MONTHLY } },
  // ↑ 全サービスが BANNER の Price ID を共有
}
```

**Webhook 処理で全サービスを一括更新**:

```typescript
// src/lib/stripe.ts — 全サービス ID リスト
export const ALL_SERVICE_IDS = [
  'banner', 'seo', 'interview', 'persona', 'kantan',
  'copy', 'voice', 'movie', 'lp', 'opening',
  'shindan', 'tenkai', 'interviewx', 'logo', 'video', 'presentation',
  'adsim', 'hr',
] as const

// Webhook: subscription.created / updated 時
// → ALL_SERVICE_IDS の全てに対して UserServiceSubscription を upsert
// → どのサービスから課金しても、全サービスのプランが同時に更新される
```

**プラン判定の流れ**:

```
Stripe Price ID → getPlanIdFromStripePriceId() → PlanId
  ↓
PlanId → getServiceIdFromPlanId() → ServiceId
  ↓
PlanId から 'LIGHT' / 'PRO' / 'ENTERPRISE' を抽出
  ↓
user.plan に保存 → 全 API ルートで参照
```

**BUNDLE プラン**: 特別契約向け。`BUNDLE` プランのユーザーは全サービスで `PRO` 相当の制限が適用される。

```typescript
// pricing.ts の各 get*LimitByUserPlan() 関数内
if (p === 'BUNDLE') return PRICING.proLimit  // BUNDLE は PRO 扱い
```

**旧プラン互換**: `basic` / `starter` / `business` は旧プラン名。既存契約者の Price ID 解決のために残されている。新規開発では使用しない。

#### Checkout & カスタマーポータル

```typescript
// src/lib/stripe.ts

// Checkout Session 作成（日本語・プロモーションコード対応）
createCheckoutSession({
  priceId,       // STRIPE_PRICE_IDS から取得
  userId,        // metadata に埋め込み（Webhook で参照）
  userEmail,     // Stripe 側のメール
  successUrl,    // 成功後リダイレクト先
  cancelUrl,     // キャンセル時リダイレクト先
  mode: 'subscription',
})

// カスタマーポータル（プラン変更・解約）
createCustomerPortalSession({
  customerId,    // user.stripeCustomerId
  returnUrl,     // 戻り先 URL
})
```

#### 新サービス追加時の Stripe 設定

新サービスを追加する場合、以下の手順で統一プランに組み込む:

1. `src/lib/stripe.ts` の `STRIPE_PRICE_IDS` にサービスを追加
   - **フォールバックを `BANNER_*_MONTHLY` / `BANNER_*_YEARLY` にする**（統一課金）
   ```typescript
   newservice: {
     light: {
       monthly: process.env.STRIPE_PRICE_NEWSERVICE_LIGHT_MONTHLY || BANNER_LIGHT_MONTHLY,
       yearly: process.env.STRIPE_PRICE_NEWSERVICE_LIGHT_YEARLY || BANNER_LIGHT_YEARLY,
     },
     pro: { /* 同様 */ },
     enterprise: { /* 同様 */ },
   },
   ```
2. `ALL_SERVICE_IDS` 配列にサービス ID を追加
3. `PlanId` 型に `'newservice-light' | 'newservice-pro' | 'newservice-enterprise'` を追加
4. `ServiceId` 型に `'newservice'` を追加
5. `getPlanIdFromStripePriceId()` のマッピング配列にエントリ追加
6. `src/lib/pricing.ts` に `NEWSERVICE_PRICING` と `getNewserviceLimitByUserPlan()` を追加

**注意**: 環境変数（`STRIPE_PRICE_NEWSERVICE_*`）を設定しなくても、フォールバックでバナーAI の Price ID が使われるため動作する。専用の Price ID が必要な場合のみ Stripe ダッシュボードで作成して環境変数に設定する。

### 13.2 プラン階層と価格体系

| プラン | 月額（税込） | 年額相当 | 対象 | 概要 |
|--------|------------|---------|------|------|
| **Free** | ¥0 | — | 全ユーザー | 各サービスに日次/月次制限あり。体験用 |
| **Light** | ¥2,980 | ¥35,760 | 個人・フリーランス | 制限緩和。実務に使えるレベル |
| **Pro** | ¥9,980 | ¥119,760 | 企業・チーム | 本格利用。全サービス PRO 解放 |
| **Enterprise** | ¥49,800 | ¥597,600 | 大企業・代理店 | 無制限 / チーム共有 |
| **Bundle** | — | — | 特別契約 | 全サービス一括バンドル |

### 13.3 料金プラン表記ルール（重要）

料金プランの表記では、以下を必ず守ること:

```
✅ 書く:
- 各プランで使える機能・上限値（ポジティブな情報のみ）
- 月額料金・年額料金
- 対象ユーザー像

🚫 書かない:
- 「できないこと」「含まれない機能」(❌マーク等)
- 「優先サポート」「専任サポート」「メールサポート」等のサポート関連
- 「電話対応」「営業時間」等の問い合わせ対応
- 「メール対応」「チャットサポート」等の応対関連
- 「先着順」「期間限定」等の煽り文言
```

**理由**: ネガティブな情報や応対関連の文言は導入の心理障壁になる。プランの違いは「上限値」と「使える機能」だけで表現する。

#### サポート窓口は全プラン共通

サポート対応をプランの差別化要素にしない。すべてのユーザーが同じサポートを受けられる前提で設計する:

```
✅ 全プラン共通:
- 不具合報告フォーム → 同じリンクを全プランで表示
- エラー報告フォーム → セクション17 で定義した /api/feedback/error-report を使用
- お問い合わせフォーム → サイドバーの「お問い合わせ」ボタンから共通リンクへ

🚫 やらない:
- Free は「コミュニティサポートのみ」、Pro は「メールサポート」のような差別化
- Enterprise だけに「専任サポート」を付ける
- プランごとに別の問い合わせ窓口を設置する
```

実装:
- サイドバーの「お問い合わせ」ボタン (`SidebarHelpContact.tsx`) → 共通の不具合報告 URL
- エラー画面の報告フォーム → セクション 17 のエラー報告 API へ
- 料金ページの各プランに「サポート」項目を載せない（共通機能として扱う）

詳細は [セクション 17: エラー通知 & ユーザーエラー報告システム](#17-エラー通知--ユーザーエラー報告システム) を参照。

### 13.4 サービス別利用制限の詳細

#### ドヤバナーAI（`banner`）— 月間上限・枚数ベース

| | ゲスト | Free | Light | Pro | Enterprise |
|---|--------|------|-------|-----|------------|
| 月間生成枚数 | 3枚 | 15枚 | 50枚 | 150枚 | 1,000枚 |
| サイズ | 1080×1080固定 | 1080×1080固定 | 自由指定 | 自由指定 | 自由指定 |
| 同時生成 | 3枚 | 3枚 | 3枚 | 5枚 | 5枚 |
| 履歴保存 | 7日 | 7日 | 無制限 | 無制限 | 無制限 |

```typescript
// src/lib/pricing.ts
export const BANNER_PRICING: ServicePricing = {
  guestLimit: 3, freeLimit: 15, lightLimit: 50, proLimit: 150, enterpriseLimit: 1000
}
```

#### ドヤライティングAI（`seo`）— 月間上限・文字数制限あり

| | ゲスト | Free | Light | Pro | Enterprise |
|---|--------|------|-------|-----|------------|
| 月間生成回数 | — | 3回 | 10回 | 30回 | 200回 |
| 1記事文字数 | — | 10,000字 | 15,000字 | 20,000字 | 50,000字 |
| 画像生成 | — | — | ✅ | ✅ | ✅ |
| 履歴保存 | — | 3ヶ月 | 3ヶ月 | 3ヶ月 | 3ヶ月 |

```typescript
export const SEO_PRICING: ServicePricing = {
  guestLimit: 0, freeLimit: 3, lightLimit: 10, proLimit: 30, enterpriseLimit: 200,
  charLimit: { guest: 5000, free: 10000, light: 15000, pro: 20000, enterprise: 50000 }
}
```

#### ドヤインタビュー（`interview`）— 月間文字起こし分数ベース

| | ゲスト | Free | Light | Pro | Enterprise |
|---|--------|------|-------|-----|------------|
| 月間文字起こし | 合計5分 | 30分 | 60分 | 150分 | 1,000分 |
| アップロード容量 | 100MB | 500MB | 1GB | 2GB | 5GB |
| 1回の文字起こし上限 | 約3時間 | 約3時間 | 約3時間 | 約3時間 | 約3時間 |
| データ保存 | 30日 | 30日 | 30日 | 30日 | 30日 |

```typescript
export const INTERVIEW_PRICING = {
  transcriptionMinutes: { guest: 5, free: 30, light: 60, pro: 150, enterprise: 1000 },
  uploadSizeLimit: { guest: 100MB, free: 500MB, light: 1GB, pro: 2GB, enterprise: 5GB }
}
```

#### ドヤコピーAI（`copy`）— 月間上限

| | ゲスト | Free | Light | Pro | Enterprise |
|---|--------|------|-------|-----|------------|
| 月間生成回数 | 3回 | 10回 | 50回 | 200回 | 1,000回 |
| 履歴保存 | 7日 | 7日 | 無制限 | 無制限 | 無制限 |

#### ドヤペルソナAI（`persona`）— 日次上限

| | ゲスト | Free | Light | Pro |
|---|--------|------|-------|-----|
| 日次生成回数 | 2回 | 5回 | 15回 | 30回 |
| 履歴保存 | 7日 | 7日 | 無制限 | 無制限 |

#### ドヤWeb診断AI（`shindan`）— 日次上限

| | ゲスト | Free | Light | Pro |
|---|--------|------|-------|-----|
| 日次診断回数 | 1回 | 3回 | 10回 | 20回 |
| PDF書き出し | — | — | — | ✅ |

#### ドヤボイスAI（`voice`）— 月間上限

| | Free | Light | Pro | Enterprise |
|---|------|-------|-----|------------|
| 月間生成回数 | 10回 | 50回 | 200回 | 1,000回 |

#### ドヤムービーAI（`movie`）— 月間上限

| | Free | Light | Pro | Enterprise |
|---|------|-------|-----|------------|
| 月間生成本数 | 3本 | 10本 | 30本 | 200本 |

#### ドヤHR（`hr`）— 従業員数ベース

| | Free | Starter | Pro | Enterprise |
|---|------|---------|-----|------------|
| 従業員数上限 | 5名 | 30名 | 100名 | 無制限 |
| 月額 | ¥0 | ¥4,980 | ¥14,800 | ¥49,800 |

#### ドヤ勤怠（`kintai`）— 従業員数ベース

| | Free | Starter | Pro | Enterprise |
|---|------|---------|-----|------------|
| 従業員数上限 | 5名 | 30名 | 100名 | 無制限 |
| 月額 | ¥0 | ¥2,980 | ¥9,980 | ¥49,800 |

### 13.4 アクセス制御の仕組み

#### ユーザー種別と認証フロー

```
ゲスト（未ログイン）
  ├─ Cookie ベースで使用回数を管理
  ├─ 各サービスの guestLimit まで利用可能
  └─ 一部サービスは利用不可（SEO等）

無料ユーザー（Google OAuth ログイン済み）
  ├─ DB の UserServiceSubscription で使用回数管理
  ├─ 各サービスの freeLimit まで利用可能
  └─ 初回ログイン後 1 時間は「生成し放題」

有料ユーザー（Stripe サブスクリプション有効）
  ├─ user.plan フィールドで判定（'LIGHT' | 'PRO' | 'ENTERPRISE' | 'BUNDLE'）
  ├─ 各サービスの該当プランの上限まで利用可能
  └─ BUNDLE は全サービス PRO 扱い
```

#### リセットタイミング

| 種別 | リセット | 実装 |
|------|---------|------|
| 日次制限 | JST 00:00 | `getTodayDateJST()` で日付比較 |
| 月次制限 | 月初 1 日 | 月の変わり目で `monthlyUsage` リセット |

```typescript
// JST基準の日次リセット
export function getTodayDateJST(): string {
  const jst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10) // 'YYYY-MM-DD'
}
```

#### 初回ログイン 1 時間生成し放題

```typescript
export function isWithinFreeHour(firstLoginAt: string | null): boolean {
  if (!firstLoginAt) return false
  return Date.now() - new Date(firstLoginAt).getTime() < 60 * 60 * 1000
}
```

UI 表示: `SidebarFreeHourBanner` コンポーネントが残り時間をリアルタイム表示（1 秒更新）

#### 使用回数の管理

```typescript
// DB更新パターン
await prisma.userServiceSubscription.upsert({
  where: { userId_serviceId: { userId, serviceId: 'banner' } },
  update: { dailyUsage: { increment: 1 } },
  create: { userId, serviceId: 'banner', dailyUsage: 1 },
})
```

#### 制限無効化（開発/テスト用）

```bash
DOYA_DISABLE_LIMITS=1        # 全サービスの制限を無効化
SEO_DISABLE_LIMITS=1         # SEOのみ無効化
BANNER_DISABLE_LIMITS=1      # バナーのみ無効化
INTERVIEW_DISABLE_LIMITS=1   # インタビューのみ無効化
PERSONA_DISABLE_LIMITS=1     # ペルソナのみ無効化
SHINDAN_DISABLE_LIMITS=1     # 診断のみ無効化
```

### 13.5 Stripe 統合の詳細

#### 環境変数（Price ID）

```bash
# 各サービス共通パターン（monthly / yearly）
STRIPE_PRICE_{SERVICE}_{PLAN}_{MONTHLY|YEARLY}

# 例:
STRIPE_PRICE_BANNER_LIGHT_MONTHLY=price_xxx
STRIPE_PRICE_BANNER_PRO_MONTHLY=price_xxx
STRIPE_PRICE_SEO_LIGHT_MONTHLY=price_xxx
STRIPE_PRICE_INTERVIEW_PRO_MONTHLY=price_xxx
STRIPE_PRICE_HR_STARTER_MONTHLY=price_xxx
```

**統一課金の実装**: 全サービスの Price ID が未設定の場合、バナーAI の Price ID にフォールバック（＝同一商品として課金）。

#### Webhook 処理

```
Stripe → /api/stripe/webhook
  ├─ checkout.session.completed → プラン有効化
  ├─ customer.subscription.updated → プラン変更反映
  ├─ customer.subscription.deleted → プラン無効化
  └─ invoice.payment_succeeded → 支払い成功記録
```

#### 手動同期エンドポイント

```
GET /api/stripe/sync/latest → Stripe の最新状態を DB に反映
```

### 13.6 料金ページ UI パターン

```tsx
// 標準的な料金ページ構造
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {plans.map(plan => (
    <div className={cn(
      "rounded-2xl border p-6",
      plan.popular && "ring-2 ring-blue-500 shadow-lg"
    )}>
      <h3>{plan.name}</h3>
      <div className="text-3xl font-bold">{plan.priceLabel}</div>
      <span className="text-sm text-slate-500">{plan.period}</span>
      <ul>{plan.features.map(f => <li>✓ {f.text}</li>)}</ul>
      <CheckoutButton planId={plan.id} />
    </div>
  ))}
</div>
```

### 13.7 新サービスの課金設定チェックリスト

1. **`src/lib/pricing.ts`** に `{SERVICE}_PRICING` 定数を追加
   - `guestLimit`, `freeLimit`, `lightLimit`, `proLimit`, `enterpriseLimit` を設定
   - `plans` 配列に Free / Light / Pro / Enterprise のプラン詳細を定義
   - `get{Service}LimitByUserPlan()` 関数を追加
2. **`src/lib/services.ts`** の Service オブジェクトの `pricing` フィールドに反映
3. **`src/lib/stripe.ts`** の `STRIPE_PRICE_IDS` にサービスを追加
   - 統一課金の場合はバナーAI の Price ID をフォールバックに設定
4. **Stripe ダッシュボード** で Price ID を作成（任意・専用 Price が必要な場合のみ）
5. **`.env.local`** と **Vercel 環境変数** に `STRIPE_PRICE_{SERVICE}_*` を設定
6. **料金ページ** (`/{service}/pricing/page.tsx`) を作成
7. **アクセス制御 API** で `get{Service}LimitByUserPlan()` を呼び出して制限チェック
8. **`UsageLimitBanner`** で制限到達時のアップセル表示を実装

---

## 14. デザイン方針 —「かわいい・楽しい・わかりやすい」

> ドヤマーケAI の最優先デザイン方針:
> **とにかくポップで、全体的に使いやすく分かりやすいツール。**
> 「かわいくて楽しい」が第一印象。触っているだけでワクワクする UI を目指す。

### 14.1 3 つの柱

| 柱 | 方針 | 具体的な指標 |
|---|------|------------|
| **かわいい** | 全体的にかわいくする | 丸み・キャラクター・パステル＋ビビッドな配色 |
| **楽しい** | アニメーションを大きく、楽しく見せる | 動きがあって、使うたびに嬉しい |
| **わかりやすい** | 文字を太くして視認性を高める | 一目で何ができるか分かる |

---

### 14.2 かわいくする — デザインルール

#### 角丸は大きく、とにかく丸く

```
ボタン:       rounded-xl (12px) 〜 rounded-2xl (16px)
カード:       rounded-2xl (16px) 〜 rounded-3xl (24px)
モーダル:     rounded-3xl (24px)
バッジ:       rounded-full (pill 型)
アイコン背景:  rounded-xl (12px) 〜 rounded-full
入力フィールド: rounded-xl (12px)
```

角張った要素は使わない。`rounded-lg` (8px) 以下は原則禁止。

#### カラーは鮮やかに、グラデーションを多用

```
✅ やる:
- ヒーロー部分にグラデーション背景（Blue→Purple→Pink）
- CTA ボタンにグロー効果（shadow-glow-blue / shadow-glow-purple）
- アクセントに Emoji を大きく使う（text-3xl 以上）
- カードホバー時にサービスカラーのボーダーや影
- 成功時にキャラクター + コンフェティ的な演出
- 背景にうっすらとしたグラデーション（from-{color}-50 系）

❌ やらない:
- 彩度の低いグレー系だけでページを構成
- テキストだけの無機質な画面
- 暗い色だけで画面を埋める
```

#### キャラクターを積極的に活用

ドヤくん（15 ムード）を積極的に配置する。「ツールを使ってる」より「ドヤくんと一緒に作業してる」感覚。

```
✅ やる:
- ダッシュボードの空状態 → hello キャラ + 「一緒にがんばろう！」
- AI 生成中 → working キャラ + 「もくもく作業中...」（大きく表示）
- 生成完了 → success or jump キャラ + お祝い演出
- エラー発生 → error キャラ + 「うぅ...エラーだ...」
- 上限到達 → ramen キャラ + 「休憩も大事だよ〜」→ アップセル
- PRO 昇格 → jump キャラ + 紙吹雪アニメーション
- アップセルモーダル → present キャラ

❌ やらない:
- 1 画面に複数キャラクターを同時表示
- キャラクターでエラーの本質を隠す
```

---

### 14.3 楽しくする — アニメーションルール

**基本方針: 動きは大きく、気持ちよく。「おっ！」と思わせる。**

#### ページ登場アニメーション

全ページ・全カードに登場アニメーションを付ける。静的な画面は作らない。

```
ページ全体:    fade-in-up（下から 20px 浮き上がり、0.5s）
カード群:      stagger 表示（0.1s ずつずらして順番に登場）
モーダル:      scale 0.85→1 + backdrop-blur（弾むように登場）
サイドパネル:   slide-in-right（右からスライド）
ドロップダウン: fade-in-down + scale-in（上から降りてくる）
```

#### インタラクションアニメーション

ユーザーの操作に対して必ずリアクションする。押した感・触った感を大切に。

```
ボタンホバー:   translateY(-3px) + shadow 拡大（大きくリフト）
ボタンクリック:  scale(0.95) → scale(1)（押し込み → 戻り）
カードホバー:   translateY(-4px) + shadow-lg + ボーダーカラー変化
リンクホバー:   色変化 + underline アニメーション
トグル切替:    spring アニメーション（弾む動き）
タブ切替:      layoutId でインジケーターがスムーズ移動
```

#### 状態変化アニメーション

```
ローディング:   キャラクター（working）+ パルスグロー + プログレスバー
             → 生成中は退屈させない。進捗表示 + キャラの一言
成功:         scale-in + confetti（紙吹雪）的な演出
             → キャラクター（success/jump）が大きく表示
エラー:       shake アニメーション + キャラクター（error）
             → 深刻にしすぎず、キャラの一言で和らげる
コピー完了:    チェックマークが bounce-in で表示
保存完了:      トーストが slide-in + 自動消去
```

#### キャラクターアニメーション

```
通常待機:    float（ふわふわ上下、3s infinite）← 常に動いている
登場時:      bounce-in（ぽよんと跳ねて登場）
注目時:      wiggle（ぶるぶる揺れる）
成功時:      jump → float に遷移
```

---

### 14.4 わかりやすくする — テキスト & レイアウトルール

**基本方針: 文字は太く大きく。一目で分かる。迷わせない。**

#### フォントウェイト

```
見出し（h1〜h3）: font-extrabold (800) または font-black (900)
                → 太ければ太いほどいい。遠慮しない
サブ見出し:       font-bold (700)
本文:            font-medium (500) 〜 font-semibold (600)
                → 通常の font-normal (400) は使わない
補足テキスト:     font-medium (500) + text-slate-500
ボタン:          font-bold (700) 〜 font-extrabold (800)
```

**font-normal (400) は原則禁止。** 最低でも font-medium (500) を使う。

#### フォントサイズ

```
ヒーロー見出し:   text-4xl sm:text-5xl lg:text-7xl font-black
セクション見出し:  text-2xl lg:text-4xl font-extrabold
カード見出し:     text-xl font-bold
本文:            text-base font-medium
サービス Emoji:   text-4xl 〜 text-6xl（大きく目立たせる）
ステータスバッジ:  text-sm font-bold
```

#### レイアウトの原則

```
✅ やる:
- 余白をたっぷり取る（p-6 以上、gap-6 以上）
- 1 画面の情報量を絞る（スクロールさせてもいいから詰め込まない）
- Emoji + テキストのセットで項目を表現する
- カード UI を基本にする（情報をカードで区切る）
- アクションボタンは目立つ位置に大きく配置

❌ やらない:
- テキストだけの一覧（必ずアイコンや Emoji を添える）
- 小さなボタン（最低 px-6 py-3）
- 余白のない詰め込みレイアウト
- 長い説明文（3 行以上は要約するか折りたたむ）
```

#### 色でステータスを伝える

```
成功/完了:   emerald-500 系 + ✅ アイコン
進行中:     blue-500 系 + ローディングアニメーション
警告/注意:   amber-500 系 + ⚠️ アイコン
エラー:     red-500 系 + キャラクター（error）
PRO 限定:   グラデーション（purple→pink）+ ✨ アイコン
NEW:       emerald→teal グラデーションバッジ
```

---

### 14.5 画面デザインチェックリスト

新しい画面を作ったら以下を **すべて** 確認する:

#### かわいさ
- [ ] 角丸が `rounded-xl` 以上になっている
- [ ] 画面に最低 1 つのグラデーション要素がある（ボタン、ヘッダー、カード）
- [ ] Emoji が大きく（text-3xl 以上）使われている
- [ ] 空状態にキャラクターがいる
- [ ] 色使いがサービスのテーマカラーと整合している

#### 楽しさ
- [ ] ページ登場時に fade-in-up アニメーションがある
- [ ] カードが stagger（時間差）で順番に表示される
- [ ] ボタン・カードにホバーエフェクトがある（lift + glow）
- [ ] 成功時にキャラクター + お祝い演出がある
- [ ] ローディング中にキャラクター（working）が表示される

#### わかりやすさ
- [ ] 見出しが `font-extrabold` 以上で太い
- [ ] 本文が `font-medium` 以上（font-normal は使っていない）
- [ ] ボタンが大きく目立つ（`px-6 py-3` 以上）
- [ ] 1 画面の情報量が適切（詰め込みすぎていない）
- [ ] 何ができるページか、3 秒以内に分かる

---

## 15. 共通機能 & 共通データベース管理

### 15.1 認証システム（全サービス共通）

**方式**: NextAuth.js v4 + Google OAuth

```
ユーザー → Google OAuth ログイン → NextAuth → JWT セッション（30日有効）
         → DB User レコード作成/更新
         → session.user にプラン情報等を付加
```

**関連ファイル**:
- `src/lib/auth.ts` — NextAuth 設定（authOptions）
- `src/app/api/auth/[...nextauth]/route.ts` — ハンドラー
- `src/app/auth/signin/page.tsx` — カスタムログインページ

**セッション仕様**:
- 戦略: JWT（DB セッションではなくトークンベース）
- 有効期限: 30 日
- セッション取得時: 毎回 DB から User を取得してプラン情報を反映（即時反映のため）
- 付加フィールド: `id`, `plan`, `firstLoginAt`, `bannerPlan`, `seoPlan` 等

**API ルートでのセッション確認パターン**:
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const session = await getServerSession(authOptions)
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**管理者認証（Admin 専用）**:
- 別の認証フロー: `src/lib/admin-auth.ts`
- bcrypt ハッシュ（12 ラウンド）
- Cloudflare Turnstile CAPTCHA
- レート制限（15 分間に最大 5 回）
- JWT トークン（24 時間有効）

### 15.2 データベース管理（全サービス共通）

**ORM**: Prisma 5.7+ + PostgreSQL (Supabase)

**共通テーブル（全サービスで使用）**:

| テーブル | 用途 | 関連サービス |
|---------|------|------------|
| `User` | ユーザー情報・プラン | 全サービス |
| `Account` | OAuth アカウント（Google） | 認証 |
| `Session` | セッション管理（JWT 補助） | 認証 |
| `VerificationToken` | メール認証トークン | 認証 |
| `Subscription` | Stripe サブスクリプション | 課金 |
| `UserServiceSubscription` | サービス別使用量管理 | 全サービス |
| `Service` | サービス定義 | 管理画面 |
| `SystemSetting` | システム設定（Slack URL 等） | 運用 |
| `Generation` | 汎用生成ログ | 一部サービス |

**サービス固有テーブルの命名規則**:
```prisma
// プレフィックス付きマッピングで名前空間を分離
model InterviewProject {
  @@map("interview_project")
}
model TenkaiProject {
  @@map("tenkai_project")
}
```

**DB操作パターン**:
```typescript
import { prisma } from '@/lib/prisma'

// Prisma シングルトン（開発時はグローバルキャッシュ）
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 15.3 データ分離 & セキュリティ（絶対遵守）

> **最重要ルール: あるユーザーのデータが、別のユーザーに絶対に見えてはいけない。**
> DB クエリには必ず `userId` または `organizationId` のフィルターを付ける。例外なし。

#### データスコープの3分類

```
┌──────────────────────────────────────────────────────────┐
│ 1. ユーザースコープ（userId で分離）                        │
│    → SEO, Banner, Interview, Copy, LP, Voice, Movie,      │
│      Persona, AdSim, Tenkai, Opening, InterviewX          │
│    → 全クエリに where: { userId: session.user.id } が必須   │
├──────────────────────────────────────────────────────────┤
│ 2. 組織スコープ（organizationId で分離）                    │
│    → HR, Kintai                                           │
│    → getHrContext() / getKintaiContext() で組織 ID を取得    │
│    → 全クエリに where: { organizationId } が必須            │
├──────────────────────────────────────────────────────────┤
│ 3. システムスコープ（全ユーザー共通）                        │
│    → テンプレート、カテゴリ、システム設定                     │
│    → userId 不要だが、書き込みは管理者のみ                   │
└──────────────────────────────────────────────────────────┘
```

#### API ルートの必須パターン

**すべての API ルートで以下を守る。1 つでも漏れたら情報漏洩になる。**

```typescript
// ✅ 正しい: セッションチェック + userId フィルター
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // データ取得には必ず userId を含める
  const projects = await prisma.copyProject.findMany({
    where: { userId: session.user.id },  // ← これが必須
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(projects)
}
```

```typescript
// 🚫 禁止: userId フィルターなしの findMany
const projects = await prisma.copyProject.findMany({
  orderBy: { createdAt: 'desc' },
  // ← userId がない = 全ユーザーのデータが返る
})
```

```typescript
// ✅ 正しい: 個別リソースアクセス時のオーナーシップ確認
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const project = await prisma.copyProject.findUnique({
    where: { id: ctx.params.id },
  })

  // オーナーシップ確認（自分のデータか？）
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(project)
}
```

```typescript
// 🚫 禁止: ID だけでデータを返す（他人のデータが見える）
const project = await prisma.copyProject.findUnique({
  where: { id: ctx.params.id },
  // ← userId チェックがない = URL の ID を変えるだけで他人のデータが見える
})
return NextResponse.json(project)  // 🚫 危険
```

#### 組織スコープ（HR / Kintai）のパターン

```typescript
// ✅ 正しい: コンテキスト関数で組織 ID を取得 → クエリに含める
import { getHrContext } from '@/lib/hr/context'

export async function GET(req: NextRequest) {
  const ctx = await getHrContext(req)  // session + organizationId を返す
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const employees = await prisma.hrEmployee.findMany({
    where: { organizationId: ctx.organizationId },  // ← 組織で分離
  })

  return NextResponse.json(employees)
}
```

#### ゲストセッションの分離

```typescript
// ゲスト（未ログイン）のデータは Cookie の guestId で分離
const guestId = getGuestIdFromRequest(req)

const articles = await prisma.seoArticle.findMany({
  where: session?.user?.id
    ? { userId: session.user.id }   // ログイン済み → userId
    : { guestId: guestId },         // ゲスト → guestId
})
```

#### 公開データ（shareToken）の扱い

```typescript
// InterviewX の共有リンク: トークンでアクセス制御
// ✅ 正しい: ステータスチェックを含む
const project = await prisma.interviewXProject.findUnique({
  where: { shareToken: token },
})

// 公開状態でなければアクセス拒否
if (!project || !['SHARED', 'RESPONDING'].includes(project.status)) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

// 返すフィールドを制限（userId 等の内部情報は返さない）
return NextResponse.json({
  title: project.title,
  questions: project.questions,
  // userId は返さない
})
```

#### セキュリティチェックリスト（API ルート作成時に必ず確認）

- [ ] `getServerSession(authOptions)` でセッションを取得している
- [ ] セッションがない場合 401 を返している
- [ ] `findMany` に `where: { userId: session.user.id }` が含まれている
- [ ] `findFirst` / `findUnique` の結果に対して `project.userId === session.user.id` を確認している
- [ ] HR/Kintai の場合は `getHrContext()` / `getKintaiContext()` で組織 ID を取得している
- [ ] URL パラメータの `id` だけでデータを返していない（必ずオーナーシップ確認）
- [ ] ゲストアクセスの場合は `guestId` で分離している
- [ ] 公開 API の場合は返すフィールドを制限している（内部 ID やメールアドレスを含めない）
- [ ] 管理者 API の場合は `verifyAdminSession()` で管理者認証している
- [ ] `$queryRaw` / `$executeRaw`（生 SQL）は使用していない（SQL インジェクション防止）

#### 禁止事項

| 禁止 | 理由 |
|------|------|
| `findMany()` に `userId` / `organizationId` フィルターなし | 全ユーザーのデータが返る |
| URL の `id` パラメータだけでデータ返却 | ID を推測すると他人のデータが見える |
| `$queryRaw` / `$executeRaw` の使用 | SQL インジェクションの危険 |
| レスポンスに `userId` / `email` を含める（公開 API） | 個人情報漏洩 |
| セッションチェックの省略 | 未認証アクセスでデータが見える |
| 他ユーザーの `userId` を受け取って処理する | なりすまし攻撃 |

#### 現状の監査結果（2026-05-27）

全 150+ の API エンドポイントを監査した結果:

- **userId フィルター漏れ**: 検出なし ✅
- **オーナーシップ確認漏れ**: 検出なし ✅
- **生 SQL 使用**: 検出なし ✅
- **管理者認証漏れ**: 検出なし ✅
- **ゲストセッション分離**: 正常 ✅
- **共有トークンのアクセス制御**: 正常 ✅

**既存の実装パターン**:
- `checkOwnership()` — Interview, InterviewX 等で使用
- `getHrContext()` — HR モジュールの組織分離
- `getKintaiContext()` — 勤怠モジュールの組織分離
- `where: { id, userId }` — 大半のサービスで直接フィルター

---

### 15.4 ミドルウェア（全ルート共通）

```typescript
// middleware.ts (プロジェクトルート)
// Slide サブドメインのリライトのみ実行
// slide.doya-ai.surisuta.jp → /slide/* にリライト
```

### 15.4 共通イベント通知（Slack）

```typescript
// src/lib/notifications.ts
// ログイン/サインアップ/決済完了/解約 → Slack Incoming Webhook
// Webhook URL は DB SystemSetting テーブルで管理
```

### 15.5 共通コンポーネントの依存関係

```
layout.tsx (Root)
├── Providers (NextAuth SessionProvider)
├── GoogleTagManager
├── LogoutToastListener      ← ログアウト後のトースト
└── PlanUpdatedListener      ← プラン変更後の通知

サービス layout.tsx
├── ServiceSidebar           ← テーマ付きサイドバー
│   ├── SidebarLogoSection
│   ├── SidebarNavLink × N
│   ├── ToolSwitcherMenu     ← サービス間遷移（active のみ表示）
│   ├── SidebarFreeHourBanner
│   └── SidebarUserProfile
└── main content
```

---

## 16. メール配信システム（Resend + ドリップマーケティング）

### 16.1 基盤: Resend API 統合

| 項目 | 詳細 |
|------|------|
| パッケージ | `resend` v6.12.4 |
| 実装方式 | Resend HTTP API を fetch で直接呼び出し（`src/lib/email.ts`） |
| 送信元 | `noreply@doya-ai.surisuta.jp`（デフォルト） |
| 環境変数 | `RESEND_API_KEY`（必須）、`RESEND_FROM_EMAIL`（任意） |

```typescript
// src/lib/email.ts — コア送信関数
export async function sendEmail(params: {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
  tags?: { name: string; value: string }[]
}): Promise<{ success: boolean; id?: string; error?: string }>
```

### 16.2 ドリップマーケティングエンジン（自動ステップメール）

管理画面から設定可能な、本格的な自動メール配信ワークフロー。

#### ワークフロー全体像

```
┌─────────────────────────────────────────────────────────┐
│ 管理画面 (/admin/drip/)                                   │
│  ├─ セグメント作成（対象ユーザー条件）                       │
│  ├─ テンプレート作成（HTML メール本文）                      │
│  └─ シーケンス作成（ステップ群 + スケジュール）              │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ ユーザー登録 → DripEnrollment レコード作成                  │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 毎時 Cron 実行 (/api/cron/drip-sender)                    │
│  ├─ アクティブな Enrollment を取得                         │
│  ├─ 送信条件を評価:                                       │
│  │   ├─ 送信時間帯内か（sendWindowStart〜sendWindowEnd）   │
│  │   ├─ 日数オフセット到達か（enrolledAt + dayOffset）     │
│  │   └─ 送信時刻に合致するか                               │
│  ├─ 条件分岐を評価（前メールの開封/クリック状況）            │
│  ├─ テンプレート変数を置換                                  │
│  ├─ トラッキングピクセル & クリック URL を埋め込み           │
│  ├─ Resend 経由で送信                                      │
│  ├─ DripEmailLog に記録                                    │
│  └─ 次ステップへ進む or 完了                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ トラッキング                                               │
│  ├─ 開封: /api/t/open/[trackingId] — 1x1 透明 GIF         │
│  ├─ クリック: /api/t/click/[trackingId]/[linkId] — 302     │
│  └─ 配信停止: /api/drip/unsubscribe?token={HMAC token}     │
└─────────────────────────────────────────────────────────┘
```

#### DB モデル（8 テーブル）

| テーブル | 用途 |
|---------|------|
| `DripSegment` | ターゲットセグメント（条件定義） |
| `DripTemplate` | メールテンプレート（HTML + テキスト） |
| `DripSequence` | シーケンス（キャンペーン単位、draft/active/paused） |
| `DripStep` | シーケンス内の各ステップ（日数オフセット・送信時刻・条件分岐） |
| `DripEnrollment` | ユーザーの進捗管理（1 ユーザー × 1 シーケンス） |
| `DripEmailLog` | 配信ログ（開封/クリック/バウンス追跡） |
| `DripUnsubscribe` | 配信停止記録 |
| `DripSetting` | グローバル設定（送信時間帯・レート制限等） |

#### 条件分岐（前ステップの開封/クリック状況で分岐）

```typescript
case 'not_opened':         // 前メール未開封
case 'opened':             // 前メール開封済み
case 'not_clicked':        // 前メール未クリック
case 'clicked':            // 前メールクリック済み
case 'opened_not_clicked': // 開封したがクリックしていない
```

#### テンプレート変数

| 変数 | 置換内容 |
|------|---------|
| `{{user_name}}` | ユーザー名（未設定時「お客様」） |
| `{{email}}` | メールアドレス |
| `{{plan}}` | サブスクリプションプラン |
| `{{last_login}}` | 最終ログイン日（JP 形式） |
| `{{days_since_login}}` | 最終ログインからの日数 |
| `{{registered_at}}` | 登録日（JP 形式） |
| `{{enrolled_at}}` | エンロール日（JP 形式） |

#### DripSetting 設定項目

| キー | デフォルト | 説明 |
|------|----------|------|
| `fromName` | — | 差出人名 |
| `fromEmail` | — | 送信元アドレス |
| `replyTo` | — | 返信先 |
| `timezone` | — | タイムゾーン |
| `sendWindowStart` | `09:00` | 送信開始時刻 |
| `sendWindowEnd` | `21:00` | 送信終了時刻 |
| `rateLimit` | `100` | 時間あたり送信数上限 |
| `unsubscribeEnabled` | `true` | 配信停止リンク表示 |

#### 配信停止（コンプライアンス対応）

- HMAC-SHA256 署名付きトークン（90 日有効）
- シークレット: `DRIP_UNSUBSCRIBE_SECRET`（未設定時 `NEXTAUTH_SECRET` にフォールバック）
- ユーザー列挙攻撃を防止（無効トークンでも同じエラー表示）

### 16.3 サービス固有トランザクションメール

| サービス | ファイル | メール種別 | トリガー |
|---------|---------|----------|---------|
| ドヤHR | `src/lib/hr/email.ts` | 従業員招待 | 管理者が「招待」ボタン押下 |
| ドヤ勤怠 | `api/kintai/employees/[id]/invite/route.ts` | 勤怠システム招待 | 管理者が従業員を招待 |
| ドヤヒヤリングAI | `src/lib/interviewx/email.ts` | アンケート招待 + 回答完了通知 | プロジェクト作成 / 回答完了 |

### 16.4 展開AI ニュースレター生成

`src/lib/tenkai/prompts/newsletter.ts` で AI がニュースレター用 HTML メールを生成。
件名・プレビューテキスト・本文（インラインスタイル HTML）・CTA を構造化 JSON で出力。

### 16.5 管理画面 API

| エンドポイント | メソッド | 用途 |
|-------------|---------|------|
| `/api/admin/drip/settings` | GET/PUT | グローバル設定 |
| `/api/admin/drip/templates` | GET/POST | テンプレート管理 |
| `/api/admin/drip/templates/[id]` | PATCH/DELETE | テンプレート編集 |
| `/api/admin/drip/sequences` | GET/POST | シーケンス管理 |
| `/api/admin/drip/sequences/[id]` | GET/PATCH/DELETE | シーケンス編集 |
| `/api/admin/drip/sequences/[id]/steps` | GET/POST | ステップ管理 |
| `/api/admin/drip/segments` | GET/POST | セグメント管理 |
| `/api/admin/drip/dashboard` | GET | 配信分析ダッシュボード |
| `/api/admin/drip/logs` | GET | 配信ログ |
| `/api/admin/drip/users` | GET | 登録ユーザー一覧 |
| `/api/admin/drip/users/[id]/timeline` | GET | ユーザー行動タイムライン |

### 16.6 メール関連の環境変数

```bash
# Resend（必須）
RESEND_API_KEY=re_xxxxxxxxxxxx

# 送信元（任意）
RESEND_FROM_EMAIL=noreply@doya-ai.surisuta.jp

# 配信停止トークン署名（任意、NEXTAUTH_SECRET にフォールバック）
DRIP_UNSUBSCRIBE_SECRET=xxxxxxxx

# Cron 認証（推奨）
CRON_SECRET=xxxxxxxx
```

---

## 17. エラー通知 & ユーザーエラー報告システム

### 17.1 既存のエラー通知基盤

#### バックエンド自動通知（`errorHandler.ts` → Slack）

API でエラーが発生した際に自動で Slack に通知する仕組みが実装済み。

```typescript
// src/lib/errorHandler.ts
export async function notifyApiError(params: {
  error: Error
  request: NextRequest
  session?: Session
}): Promise<void>
```

送信される情報: エラーメッセージ、スタックトレース、リクエスト URL/メソッド/ボディ、ユーザー情報

```typescript
// src/lib/notifications.ts — Slack 送信
export async function sendErrorNotification(data: {
  path: string
  status: number
  method: string
  url: string
  message: string
  body?: string
  stack?: string
  userId?: string
  userEmail?: string
  userName?: string
}): Promise<void>
```

#### イベント通知（Slack）

| イベント | Emoji | タイミング |
|---------|-------|----------|
| サインアップ | 🎉 | 新規ユーザー登録時 |
| ログイン | 🚪 | 既存ユーザーログイン時 |
| サブスクリプション | 💳 | 課金成功時 |
| 解約 | 👋 | サブスク解約時 |
| 支払い失敗 | ⚠️ | 決済失敗時 |

### 17.2 ユーザー向けエラー報告フォーム（必須仕様）

**全サービス共通ルール**: 404 やエラーが発生してリトライしても解消しない場合、ユーザーがエラー内容を報告できるフォームを必ず表示する。報告内容は Slack に通知される。

#### 表示条件

```
エラー発生（404 / 500 / タイムアウト等）
  → リトライボタン表示
  → リトライしても解消しない
  → エラー報告フォームを表示
```

具体的には:
- **404 ページ** (`not-found.tsx`): 常にエラー報告フォームを表示
- **エラーバウンダリ** (`error.tsx`): リトライボタン + エラー報告フォームを併設
- **API エラー（各サービス画面内）**: リトライ失敗後にエラー報告フォームを表示

#### フォーム仕様

```
┌─────────────────────────────────────────────┐
│  Character（error）                           │
│  「うぅ...エラーだ...報告してくれると助かる！」  │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ 何をしていましたか？（任意）               │ │
│  │ [テキストエリア]                           │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │ 改善してほしい点（任意）                   │ │
│  │ [テキストエリア]                           │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  [自動収集情報（折りたたみ表示）]               │
│   - エラー種別: 404 / 500 / timeout 等         │
│   - URL: 発生したページ                        │
│   - ブラウザ / OS                              │
│   - ユーザー ID（ログイン済みの場合）           │
│   - タイムスタンプ                             │
│                                               │
│  [ 報告する ]  ← btn-primary（グラデーション）  │
│                                               │
│  送信後 → Character（thumbsup）                │
│  「ありがとう！すぐ確認するね！」               │
└─────────────────────────────────────────────┘
```

#### API 仕様

```
POST /api/feedback/error-report

Request:
{
  errorType: '404' | '500' | 'timeout' | 'unknown'
  errorUrl: string          // 発生 URL（自動取得）
  errorMessage?: string     // エラーメッセージ（自動取得）
  userDescription?: string  // ユーザー入力: 何をしていたか
  userSuggestion?: string   // ユーザー入力: 改善点
  browser?: string          // UA（自動取得）
  timestamp: string         // ISO 8601（自動取得）
}

Response:
{ success: true }
```

#### Slack 通知フォーマット

```
🐛 エラー報告が届きました

エラー種別: 404
URL: https://doya-ai.surisuta.jp/banner/xxx
ユーザー: k-mitsumori@surisuta.jp (PRO)
日時: 2026-05-27 15:30 JST

💬 ユーザーの声:
何をしていたか: バナーを新規作成しようとした
改善してほしい点: ボタンを押しても何も起こらない

🔧 技術情報:
Browser: Chrome 126 / macOS 14.3
Error: Page not found
```

#### 実装チェックリスト

- [ ] `src/components/common/ErrorReportForm.tsx` — 共通コンポーネント作成
- [ ] `src/app/api/feedback/error-report/route.ts` — API ルート作成
- [ ] `src/app/not-found.tsx` にフォーム組み込み
- [ ] `src/app/error.tsx` にフォーム組み込み
- [ ] `src/lib/notifications.ts` に `sendErrorReportNotification()` 追加
- [ ] キャラクター活用: 送信前 `error`、送信後 `thumbsup`

#### デザインルール（セクション 14 準拠）

- フォームは**押しつけがましくない**が、**見つけやすい**位置に配置
- キャラクター（error → thumbsup）で親しみやすさを演出
- テキストエリアは `rounded-xl`、ボタンは `btn-primary`（グラデーション + グロー）
- 送信後はキャラクターアニメーション（`bounce-in`）でお礼を表示
- 自動収集情報は折りたたみ（デフォルト非表示）で透明性を確保

### 17.3 404・エラーページ共通フッターリンク（必須仕様）

すべての 404 ページ・エラーページの**下部に小さく**「お問い合わせ」リンクを必ず配置する。
押しつけがましくない控えめなデザインで、それでも「困ったときの逃げ道」がある安心感を提供する。

#### 表示位置 & デザイン

```
┌─────────────────────────────────────────┐
│                                           │
│       Character（error）                   │
│       「うぅ...ページが見つからない」        │
│                                           │
│       [ホームへ戻る]  [前のページへ]        │
│                                           │
│       （エラー報告フォーム）                 │
│       ...                                 │
│                                           │
│                                           │
│ ──────────────────────────────  │
│  ご不明な点はお問い合わせください →         │  ← ★ ここに小さく配置
│ ──────────────────────────────  │
└─────────────────────────────────────────┘
```

#### スタイル仕様

```tsx
{/* 404・エラーページ共通フッター */}
<footer className="mt-16 pt-8 border-t border-slate-100">
  <div className="text-center">
    <a
      href={SUPPORT_CONTACT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium"
    >
      ご不明な点はお問い合わせください →
    </a>
  </div>
</footer>
```

#### 設計原則

- **小さく**: `text-xs`（12px）でフッター扱い
- **控えめな色**: `text-slate-400` → ホバーで `text-slate-600`
- **上に区切り線**: `border-t border-slate-100` で本文と分離
- **押しつけない**: ボタン化しない・グラデーション禁止・キャラ付けない
- **新規タブ**: `target="_blank"` で開く（ユーザーが元の画面に戻れる）
- **共通リンク先**: `SUPPORT_CONTACT_URL`（全プラン共通の不具合報告 URL）

#### 適用対象（必須）

| ページ | パス | フッターリンク配置 |
|--------|------|----------------|
| 404 ページ | `src/app/not-found.tsx` | ✅ 必須 |
| エラーバウンダリ | `src/app/error.tsx` | ✅ 必須 |
| サービス別 404 | 各サービスの `not-found.tsx` | ✅ 必須 |
| メンテナンス画面 | サービスの maintenance 表示時 | ✅ 必須 |
| 認証エラー | `/auth/error` | ✅ 必須 |
| 利用制限到達 | `UsageLimitBanner` 等 | 任意（上限到達はアップセル優先） |

#### 実装チェックリスト

- [ ] `src/app/not-found.tsx` にフッターリンク追加
- [ ] `src/app/error.tsx` にフッターリンク追加
- [ ] 各サービスの `not-found.tsx` にも追加
- [ ] `SUPPORT_CONTACT_URL` を `src/lib/pricing.ts` で一元管理
- [ ] 全ページで同じスタイル（小さく・控えめ）になっているか確認

#### サポート対応の一貫性

このフッターリンクは [セクション 13.3 の「サポートは全プラン共通」](#13-課金--アクセス制御--完全仕様) の方針と連動:

- リンク先は **全プラン共通** の `SUPPORT_CONTACT_URL`
- Free / Light / Pro / Enterprise で別リンクにしない
- 「優先サポート」「専任サポート」等のプラン差別化はしない
- セクション 17.2 のエラー報告フォームと併用可能（フォームでは自動収集、リンクは任意）

---

## 18. 管理画面（/admin）— 統合コントロールセンター

> 管理画面は、全サービスの活用状況・ユーザー管理・課金・設定を **1 つの画面から一元管理** できる統合コントロールセンター。
> サービスが増えても、管理画面から全てを見渡して調整できる状態を維持する。

### 18.1 現在の管理画面構成

```
/admin/
├── page.tsx              ← ダッシュボード（KPI・サービス別実績・直近アクティビティ）
├── users/                ← ユーザー管理（検索・プラン変更・使用量リセット・CSV/JSONエクスポート）
├── analytics/            ← アナリティクス（生成数・ユーザー数・成長率）
├── billing/              ← 売上・課金（月次売上・MRR・サービス別売上・転換率）
├── admins/               ← 管理者アカウント（作成・権限管理・パスワードリセット）
├── settings/             ← 設定（API・使用制限・GTM/HubSpot・Slack・メンテナンスモード）
├── templates/            ← テンプレート管理（追加・編集・有効化/無効化・PRO限定フラグ）
├── drip/                 ← ドリップ配信
│   ├── page.tsx          ← 配信ダッシュボード（送信数・開封率・クリック率）
│   ├── sequences/        ← シーケンス管理
│   ├── templates/        ← メールテンプレート管理
│   ├── users/            ← 配信ユーザー管理
│   ├── logs/             ← 配信ログ
│   └── settings/         ← 配信設定
├── doyamana-images/      ← ドヤマナAI 画像管理
├── doyamana-categories/  ← ドヤマナAI カテゴリ管理
└── login/                ← 管理者ログイン（JWT・レート制限・Turnstile CAPTCHA）
```

### 18.2 管理画面でできること（現状）

#### ダッシュボード（KPI 概要）

| KPI | 内容 | 更新 |
|-----|------|------|
| 総ユーザー数 | Free / Pro / Enterprise の内訳 | リアルタイム |
| 本日の生成数 | 全サービス合算 | リアルタイム |
| 月間売上 | MRR（月次経常収益） | リアルタイム |
| サービス別実績 | ユーザー数・Pro数・生成数・売上・成長率（サービスごと） | リアルタイム |
| 直近アクティビティ | 過去24時間の生成ログ（ユーザー・サービス・アクション） | リアルタイム |
| セキュリティ | 管理者ログイン試行数（24時間） | リアルタイム |

#### ユーザー管理

| 機能 | 詳細 |
|------|------|
| ユーザー検索 | メールアドレス・名前で検索 |
| プランフィルター | Free / Pro / Enterprise でフィルタリング |
| プラン変更 | 統一プランでの一括変更（バナー + ライティング連動） |
| 使用量リセット | 日次/月次の使用回数をサービスごとにリセット |
| Stripe 連携確認 | サブスクリプションID・ステータス・期間表示 |
| サブスク操作 | 期間終了時解約 / 即時解約 / 再開 |
| データエクスポート | CSV（基本 / Stripe付き）・JSON 形式 |
| ユーザー削除 | 確認テキスト入力付き（カスケード削除） |

#### 売上・課金

| 機能 | 詳細 |
|------|------|
| 月間売上 | 総売上・MRR 表示 |
| ユーザー内訳 | Free / Premium / Enterprise 数 |
| 転換率 | Premium ÷ 全ユーザー |
| サービス別売上 | サービスごとの売上内訳 |

#### ドリップ配信管理

| 機能 | 詳細 |
|------|------|
| 配信ダッシュボード | 総送信数・開封率・クリック率・バウンス率 |
| シーケンス管理 | 作成・編集・開始/一時停止/停止 |
| テンプレート管理 | HTML メールテンプレートの CRUD |
| ユーザーセグメント | 条件ベースのターゲティング |
| 配信ログ | 個別メールの送信状況・開封・クリック追跡 |
| 配信設定 | 送信時間帯・レート制限・送信元・配信停止設定 |

### 18.3 管理画面から全サービスを統合管理する方針

**目標: どのサービスの状況も、管理画面 1 つで把握・調整できる。**

#### サービス統合管理ダッシュボード（実装方針）

```
/admin/services/  ← サービス一覧 & 統合管理（新規）

┌─────────────────────────────────────────────────────────┐
│ サービス統合管理                                           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 🎨 バナー  │ │ 🧠 SEO   │ │ 🎙️ インタ │ │ 📄 LP    │   │
│  │ active    │ │ active    │ │ active    │ │ active    │   │
│  │ 今日: 234 │ │ 今日: 89  │ │ 今日: 45  │ │ 今日: 23  │   │
│  │ Pro: 12人 │ │ Pro: 8人  │ │ Pro: 5人  │ │ Pro: 3人  │   │
│  │ [管理→]   │ │ [管理→]   │ │ [管理→]   │ │ [管理→]   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 🎙️ ボイス │ │ 🎬 ムービ │ │ 👥 HR    │ │ 📊 AdSim │   │
│  │ active    │ │ active    │ │ active    │ │ coming    │   │
│  │ ...       │ │ ...       │ │ ...       │ │ soon      │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                           │
│  [+ 新サービス追加]                                        │
└─────────────────────────────────────────────────────────┘
```

#### サービス個別管理ページ（実装方針）

```
/admin/services/[serviceId]/  ← サービス個別管理（新規）

┌─────────────────────────────────────────────────────────┐
│ 🎨 ドヤバナーAI — 管理                                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ ステータス: [active ▼]  ← ドロップダウンで変更可能          │
│                                                           │
│ ■ 利用状況                                                │
│   今日の生成数:  234 枚                                    │
│   今月の生成数:  5,678 枚                                  │
│   アクティブユーザー: 156 人（うち Pro 12 人）              │
│   先月比: +23%                                            │
│                                                           │
│ ■ 利用制限（この画面で即時変更可能）                        │
│   ゲスト:      [  3 ] 枚/月                               │
│   Free:        [ 15 ] 枚/月                               │
│   Light:       [ 50 ] 枚/月                               │
│   Pro:         [150 ] 枚/月                               │
│   Enterprise:  [1000] 枚/月                               │
│   [保存]                                                   │
│                                                           │
│ ■ サービス設定                                             │
│   表示名:      [ドヤバナーAI        ]                      │
│   Emoji:       [🎨]                                       │
│   カラー:      [from-purple-500 to-pink-500]              │
│   ToolSwitcher表示: [✓]                                   │
│   NEW バッジ:  [✓]                                        │
│   [保存]                                                   │
│                                                           │
│ ■ 課金設定                                                │
│   Light 月額:  [¥2,980]   Stripe Price ID: [price_xxx]    │
│   Pro 月額:    [¥9,980]   Stripe Price ID: [price_xxx]    │
│   Enterprise:  [¥49,800]  Stripe Price ID: [price_xxx]    │
│                                                           │
│ ■ このサービスのユーザー一覧                               │
│   [ユーザーテーブル（サービス別フィルター済み）]              │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

#### 共通設定管理ページ（実装方針）

```
/admin/settings/  ← 共通設定（既存を拡張）

┌─────────────────────────────────────────────────────────┐
│ 共通設定                                                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ ■ 全体設定                                                │
│   メンテナンスモード: [OFF]                                │
│   メンテナンスメッセージ: [                      ]         │
│                                                           │
│ ■ AI モデル設定                                            │
│   テキスト生成: [gemini-2.0-flash    ▼]                   │
│   画像生成:     [gpt-image-2         ▼]                   │
│   画像FB:      [nano-banana-pro-preview ▼]                │
│                                                           │
│ ■ 通知設定                                                │
│   Slack Webhook URL: [https://hooks.slack.com/xxx  ]      │
│   エラー通知: [✓] サインアップ通知: [✓]                    │
│   課金通知: [✓] 解約通知: [✓]                              │
│                                                           │
│ ■ トラッキング                                             │
│   GTM Container ID: [GTM-5B2PRCL7]                        │
│   HubSpot ID:       [48309253     ]                       │
│                                                           │
│ ■ メール配信                                               │
│   Resend From: [noreply@doya-ai.surisuta.jp]              │
│   送信時間帯:  [09:00] 〜 [21:00]                          │
│   レート制限:  [100] 通/時                                 │
│                                                           │
│ ■ 初回特典                                                │
│   1時間生成し放題: [ON]                                    │
│                                                           │
│ [保存]                                                     │
└─────────────────────────────────────────────────────────┘
```

### 18.4 管理画面の開発ルール

#### 共通設定は管理画面から変更できるようにする

```
✅ 管理画面から変更可能にすべきもの:
  - サービスのステータス（active / coming_soon / maintenance）
  - 各プランの利用制限数（日次/月次上限）
  - メンテナンスモード ON/OFF
  - Slack 通知の ON/OFF
  - メール配信設定（送信時間帯・レート制限）
  - AI モデルの選択（テキスト/画像）
  - トラッキング ID（GTM / HubSpot）

❌ コード変更が必要なもの（管理画面では変更しない）:
  - サービスの新規追加（services.ts + ページ + API が必要）
  - Stripe Price ID の作成（Stripe ダッシュボードで作成が必要）
  - DB スキーマの変更（Prisma マイグレーションが必要）
  - 認証方式の変更（NextAuth 設定）
```

#### 管理画面の認証（既存）

| 項目 | 仕様 |
|------|------|
| 認証方式 | JWT（ユーザー認証とは独立） |
| パスワード要件 | 12文字以上・大文字小文字数字記号を全て含む |
| セッション有効期限 | 24時間 |
| レート制限 | 15分間に5回失敗でロック |
| 同時セッション | 管理者1人あたり最大5セッション |
| CAPTCHA | Cloudflare Turnstile |
| ログイン履歴 | `AdminLoginAttempt` テーブルに記録（IP・UA） |

#### 管理画面 API の作り方

```typescript
// 管理者 API は verifyAdminSession() で認証する（NextAuth とは別系統）
import { verifyAdminSession } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  const admin = await verifyAdminSession(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // 管理者のみアクセス可能な処理
}
```

### 18.5 管理画面の未実装事項

| # | 項目 | 優先度 | 説明 |
|---|------|--------|------|
| 1 | **設定ページのバックエンド API** | 高 | 設定画面の UI はあるが API が未接続。変更が保存されない |
| 2 | **サービス統合管理ページ** | 高 | `/admin/services/` — サービス一覧 & 個別管理 |
| 3 | **サービスごとの利用制限変更** | 高 | 管理画面から Free/Light/Pro/Enterprise の制限値を変更 |
| 4 | **サービスステータス変更** | 高 | 管理画面から active/coming_soon/maintenance を切替 |
| 5 | **監査ログ** | 中 | 管理者の操作履歴（誰が何を変更したか） |
| 6 | **RBAC（権限管理）** | 中 | 管理者ごとに閲覧/編集権限を分ける |
| 7 | **サービス別ユーザーフィルター** | 中 | ユーザー一覧をサービス利用状況でフィルター |
| 8 | **日付範囲フィルター** | 低 | アナリティクスの期間指定 |

---

## 19. 現状の不整合・要注意事項レポート（2026-05-27 監査）

### 🔴 Critical — 即座に対応が必要

#### 16.1 services.ts のステータスと実態のズレ（4 サービス）

以下のサービスは **実装完了済み・ドキュメントでは active** だが、`services.ts` では `coming_soon` のまま。
**影響**: ToolSwitcherMenu に表示されず、ユーザーがアクセスできない。

| サービス | `services.ts` | `10-service-status.md` | 実態 |
|---------|--------------|----------------------|------|
| ドヤワイヤーフレーム AI (`lp`) | `coming_soon` | active | ページ・API 実装済み |
| ドヤコピーAI (`copy`) | `coming_soon` | active | ページ・API 実装済み |
| ドヤボイスAI (`voice`) | `coming_soon` | active | ページ・API 実装済み |
| ドヤムービーAI (`movie`) | `coming_soon` | active | ページ・API 実装済み |

**対応**: `src/lib/services.ts` で該当サービスの `status` を `'active'` に変更する。

#### 16.2 ToolSwitcherMenu 未登録のサービス

以下のサービスは `SERVICE_ICON_MAP` に未登録。`active` に変更する際に追加が必要。

- `tenkai`（現在 coming_soon）

**対応**: `active` への変更前に `src/components/ToolSwitcherMenu.tsx` の `SERVICE_ICON_MAP` への追加が必要。

### 🟡 Warning — 中優先度

#### 16.5 User モデルに複数のプランフィールドが残存

```prisma
model User {
  plan       String?   // 統一プラン ← これが正
  bannerPlan String?   // レガシー
  seoPlan    String?   // レガシー
}
```

統一プラン方式では `plan` のみで十分。`bannerPlan`, `seoPlan` はレガシーフィールド。
コード側はフォールバックロジックで対応済みだが、将来的にはカラム削除が望ましい。

#### 16.6 Stripe Webhook に冪等性チェックがない

Stripe は同じイベントを重複送信することがある。現在の Webhook ハンドラーには冪等性チェック（同一イベント ID の二重処理防止）がない。低リスクだが、`event.id` でチェックするとより堅牢。

### 🟢 Info — 認識しておくべき事項

#### 16.7 services.ts 未登録だが実装が存在するサービス

以下はページ・API が存在するが `services.ts` に未登録。意図的な設計の可能性あり:

| パス | 説明 | 推定理由 |
|------|------|---------|
| `/mitsuboshi` | ミツボシシリーズ（toC ブランド） | 独立ブランドのため別管理 |
| `/promane` | プロマネ | 内部ツール/実験的 |
| `/slide`, `/slashslide` | スライド系 | メンテナンス中・統合検討中 |

#### 16.8 定義のみで実装がないサービス

| Service ID | ステータス | 状態 |
|-----------|----------|------|
| `video` | coming_soon | API あり、ページなし |
| `presentation` | coming_soon | 完全未実装 |

#### 16.9 `as any` の広範な使用（100+ 箇所）

Prisma JSON フィールドのキャストが主因。CLAUDE.md で許容パターンとして文書化済み。型安全性の観点では理想的でないが、現実的な対応。

---

## 付録: ファイル構成クイックリファレンス

```
src/
├── app/
│   ├── {service}/           ← フロントエンド
│   │   ├── page.tsx
│   │   ├── layout.tsx       ← サイドバー付きレイアウト
│   │   ├── new/page.tsx     ← 新規作成
│   │   ├── [projectId]/     ← 詳細ページ
│   │   ├── history/         ← 履歴
│   │   └── pricing/         ← 料金
│   └── api/{service}/       ← API エンドポイント
│       └── route.ts
├── components/
│   ├── sidebar/             ← サイドバー共通コンポーネント
│   ├── {service}/           ← サービス固有コンポーネント
│   ├── promane/character.tsx ← マスコットキャラクター
│   └── ToolSwitcherMenu.tsx ← サービス間ナビゲーション
├── lib/
│   ├── services.ts          ← 全サービス定義（★ 中心ファイル）
│   ├── pricing.ts           ← 料金プラン
│   ├── stripe.ts            ← Stripe 統合
│   ├── image-generator.ts   ← 画像生成ディスパッチャ
│   └── {service}/           ← サービス固有ロジック
└── ...
```

---

## 更新履歴

| 日付 | 更新内容 |
|------|---------|
| 2026-02-17 | 初版作成 |
| 2026-05-27 | 全面改訂: UI デザイン・キャラクター・ステータス管理・サービス遷移マップ・新サービス追加チェックリストを統合。19 サービス対応 |
| 2026-05-27 | メール配信システム（Resend + ドリップマーケティング）追加。エラー報告フォーム仕様追加。kintai を coming_soon に変更 |
| 2026-05-28 | Stripe 共通プラン仕組み詳細追加。管理画面（統合コントロールセンター）セクション追加。サービス統合管理・共通設定管理の実装方針を定義 |
