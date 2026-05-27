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

### 4.2 キャラクターシステム

#### ドヤくん（メインマスコット）

**概要**: ドヤマーケAI のメインキャラクター。ポップで親しみやすい雰囲気を演出。

**アセット場所**: `public/character/`

**15 種類のムード画像**:

| ムード | ファイル | 使用場面 | デフォルト台詞 |
|--------|---------|---------|--------------|
| `hello` | `hello.png` | 初回表示・歓迎 | やあ！一緒にがんばろう！ |
| `point` | `point.png` | ヒント・ガイダンス | ここがポイントだよ！ |
| `success` | `success.png` | 完了・成功 | やったー！すごい！ |
| `working` | `working.png` | 処理中・生成中 | もくもく作業中... |
| `thinking` | `thinking.png` | 分析中・判断中 | うーん、考え中... |
| `jump` | `jump.png` | 大成功・特別な達成 | 最高！！テンション上がる！ |
| `thumbsup` | `thumbsup.png` | 確認・承認 | いいね！その調子！ |
| `surprise` | `surprise.png` | 新発見・通知 | おっ！新しい発見！ |
| `love` | `love.png` | お気に入り・好評 | このプロジェクト大好き！ |
| `ramen` | `ramen.png` | 休憩・待機 | 休憩も大事だよ〜 |
| `sleep` | `sleep.png` | アイドル状態 | zzz...おやすみ... |
| `focus` | `focus.png` | 集中作業中 | 集中！集中！ |
| `present` | `present.png` | プレゼン・結果表示 | プレゼンの時間だ！ |
| `error` | `error.png` | エラー発生 | うぅ...エラーだ... |
| `bug` | `bug.png` | バグ・問題検出 | バグ見つけた！許さない！ |

**コンポーネント**: `src/components/promane/character.tsx`

```tsx
import { Character, CharacterOnly } from '@/components/promane/character'

// 吹き出し付きキャラクター
<Character mood="success" size={80} animate="float" />

// キャラクターのみ
<CharacterOnly mood="working" size={64} animate="bounce-in" />
```

**アニメーション**: `float`（ふわふわ上下）、`bounce-in`（バウンド登場）、`wiggle`（揺れ）、`none`

#### 勤怠クマキャラクター

**アセット場所**: `public/kintai/characters/` & `public/hr/characters/`

- 同じ 15 ムード体系をクマキャラクターで実装
- ファイル名: `{mood}_{日本語}.png`（例: `working_作業中.png`）
- 勤怠管理・HR で使用

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
| 17 | ドヤHR | `hr` | `/hr` | **active** | 14頁 | 30件 | 10 | — | ❌ |
| 18 | ドヤ勤怠 | `kintai` | `/kintai` | coming_soon | ✅ | ✅ | ✅ | — | ❌ |
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

**Stripe 実装**: 全サービスがドヤバナーAI の Price ID をフォールバックとして共有。1 回の課金で全サービスの PRO が解放される。

### 13.2 プラン階層と価格体系

| プラン | 月額（税込） | 年額相当 | 対象 | 概要 |
|--------|------------|---------|------|------|
| **Free** | ¥0 | — | 全ユーザー | 各サービスに日次/月次制限あり。体験用 |
| **Light** | ¥2,980 | ¥35,760 | 個人・フリーランス | 制限緩和。実務に使えるレベル |
| **Pro** | ¥9,980 | ¥119,760 | 企業・チーム | 本格利用。全サービス PRO 解放 |
| **Enterprise** | ¥49,800 | ¥597,600 | 大企業・代理店 | 無制限 / チーム共有 / 優先サポート |
| **Bundle** | — | — | 特別契約 | 全サービス一括バンドル |

**競合との比較**:
- Copy.ai: $49/月（約¥7,500）
- Jasper: $39/月（約¥6,000）
- Canva Pro: ¥12,000/年（¥1,000/月）
- → ドヤマーケAI Light ¥2,980 は全ツール込みで競争力あり

### 13.3 サービス別利用制限の詳細

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
| 月間生成回数 | 不可 | 3回 | 10回 | 30回 | 200回 |
| 1記事文字数 | — | 10,000字 | 15,000字 | 20,000字 | 50,000字 |
| 画像生成 | — | ❌ | ✅ | ✅ | ✅ |
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
| PDF書き出し | ❌ | ❌ | ❌ | ✅ |

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

### 15.3 ミドルウェア（全ルート共通）

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

## 16. 現状の不整合・要注意事項レポート（2026-05-27 監査）

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

- `kintai`（現在 coming_soon）
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
