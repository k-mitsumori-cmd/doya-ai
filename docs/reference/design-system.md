# 🎨 ドヤAI デザインシステム

全サービスで統一されたデザインシステムです。

---

## 目次

1. [カラーパレット](#カラーパレット)
2. [タイポグラフィ](#タイポグラフィ)
3. [スペーシング](#スペーシング)
4. [コンポーネント](#コンポーネント)
5. [アイコン](#アイコン)
6. [レスポンシブ](#レスポンシブ)
7. [ダークモード対応](#ダークモード対応)

---

## カラーパレット

### CSS変数（`globals.css`）

```css
:root {
  /* ブランドカラー */
  --color-primary: #3B82F6;       /* Blue 500 */
  --color-primary-dark: #2563EB;  /* Blue 600 */
  --color-secondary: #8B5CF6;     /* Purple 500 */
  --color-accent: #EC4899;        /* Pink 500 */
  
  /* グラデーション */
  --gradient-primary: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #EC4899 100%);
  --gradient-blue: linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%);
  --gradient-purple: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%);
  --gradient-dark: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
  
  /* シャドウ */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-glow-blue: 0 0 40px rgba(59, 130, 246, 0.3);
  --shadow-glow-purple: 0 0 40px rgba(139, 92, 246, 0.3);
  
  /* トランジション */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Tailwind拡張（`tailwind.config.ts`）

```typescript
colors: {
  brand: {
    blue: '#3B82F6',
    purple: '#8B5CF6',
    pink: '#EC4899',
  },
},
boxShadow: {
  'glow-sm': '0 0 20px rgba(59, 130, 246, 0.2)',
  'glow-md': '0 0 40px rgba(59, 130, 246, 0.3)',
  'glow-lg': '0 0 60px rgba(59, 130, 246, 0.4)',
  'glow-purple': '0 0 40px rgba(139, 92, 246, 0.3)',
  'glow-pink': '0 0 40px rgba(236, 72, 153, 0.3)',
},
```

### サービス別テーマカラー

| サービス | プライマリ | グラデーション |
|----------|------------|----------------|
| ドヤバナーAI | `#2563EB` (Blue 600) | `from-blue-500 to-blue-600` |
| ドヤライティングAI | `#059669` (Emerald 600) | `from-emerald-600 to-teal-700` |
| ドヤペルソナAI | `#7C3AED` (Purple 600) | `from-purple-500 to-purple-600` |
| ドヤロゴ | `#6366F1` (Indigo 500) | `from-indigo-500 to-sky-500` |

---

## タイポグラフィ

### フォントファミリー

```css
body {
  font-family: 'Inter', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

### フォントサイズ

| クラス | サイズ | 用途 |
|--------|--------|------|
| `text-display-lg` | 4.5rem | ヒーローセクション |
| `text-display-md` | 3.75rem | ページタイトル |
| `text-display-sm` | 3rem | セクションタイトル |
| `text-3xl` | 1.875rem | カードタイトル |
| `text-xl` | 1.25rem | サブタイトル |
| `text-base` | 1rem | 本文 |
| `text-sm` | 0.875rem | 補助テキスト |
| `text-xs` | 0.75rem | キャプション |
| `text-[10px]` | 10px | バッジ、極小テキスト |

### フォントウェイト

| クラス | ウェイト | 用途 |
|--------|----------|------|
| `font-black` | 900 | 見出し、強調 |
| `font-bold` | 700 | サブ見出し |
| `font-semibold` | 600 | ボタン |
| `font-medium` | 500 | 本文（強調） |
| `font-normal` | 400 | 本文 |

---

## スペーシング

### 基本パディング

| 用途 | クラス |
|------|--------|
| ページコンテンツ | `p-4 sm:p-6 md:p-8` |
| カード内側 | `p-4 md:p-6` |
| ボタン | `px-6 py-3` (通常) / `px-4 py-2` (小) |
| サイドバー | `px-3 sm:px-4` |

### 間隔

| 用途 | クラス |
|------|--------|
| セクション間 | `space-y-8` または `gap-8` |
| カード間 | `gap-4` または `gap-6` |
| アイテム間 | `gap-2` または `gap-3` |

---

## コンポーネント

### ボタン

```html
<!-- プライマリボタン -->
<button class="btn-primary">
  保存する
</button>

<!-- セカンダリボタン -->
<button class="btn-secondary">
  キャンセル
</button>

<!-- ゴーストボタン -->
<button class="btn-ghost">
  詳細を見る
</button>
```

```css
.btn-primary {
  @apply inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold;
  background: var(--gradient-primary);
  box-shadow: var(--shadow-md), var(--shadow-glow-blue);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg), var(--shadow-glow-blue);
}
```

### カード

```html
<!-- ライトカード -->
<div class="card p-6">
  <h3>タイトル</h3>
  <p>内容</p>
</div>

<!-- ダークカード -->
<div class="card-dark p-6">
  <h3>タイトル</h3>
  <p>内容</p>
</div>
```

```css
.card {
  @apply bg-white rounded-2xl border border-slate-200 shadow-sm;
  @apply transition-all duration-300;
}

.card:hover {
  @apply shadow-lg border-slate-300;
  transform: translateY(-2px);
}
```

### 入力フィールド

```html
<!-- ライト -->
<input class="input" placeholder="入力してください" />

<!-- ダーク -->
<input class="input-dark" placeholder="入力してください" />
```

### バッジ

```html
<span class="badge-primary">PRO</span>
<span class="badge-success">完了</span>
<span class="badge-warning">保留</span>
<span class="badge-new">NEW</span>
```

### グラデーションテキスト

```html
<h1 class="text-gradient">グラデーションテキスト</h1>
<h1 class="text-gradient-blue">ブルーグラデーション</h1>
<h1 class="text-gradient-purple">パープルグラデーション</h1>
```

### ガラス効果

```html
<div class="glass p-6">
  半透明ガラス効果
</div>

<div class="glass-dark p-6">
  ダークガラス効果
</div>
```

---

## アイコン

**使用ライブラリ**: `lucide-react`

### よく使うアイコン

```tsx
import { 
  Sparkles,      // AI/魔法
  Zap,           // プラン/アップグレード
  CreditCard,    // 決済
  Settings,      // 設定
  User,          // ユーザー
  LogIn,         // ログイン
  LogOut,        // ログアウト
  HelpCircle,    // ヘルプ
  ChevronLeft,   // 折りたたみ
  ChevronRight,  // 展開
  ChevronDown,   // ドロップダウン
  Menu,          // ハンバーガー
  X,             // 閉じる
  Plus,          // 追加
  Clock,         // 履歴
  FileText,      // ドキュメント
  Image,         // 画像
  Target,        // ターゲット
  LayoutGrid,    // グリッド
  ExternalLink,  // 外部リンク
} from 'lucide-react'
```

### サイズ規約

| 用途 | クラス |
|------|--------|
| ナビアイコン | `w-5 h-5` |
| ボタンアイコン | `w-4 h-4` |
| 大きいアイコン | `w-8 h-8` |
| 極小アイコン | `w-3 h-3` |

---

## レスポンシブ

### ブレークポイント

| プレフィックス | 最小幅 |
|----------------|--------|
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |

### サイドバー

- **モバイル**: オーバーレイ（240px幅）
- **デスクトップ**: 固定（展開時240px / 折りたたみ時72px）

```css
/* メインコンテンツのパディング */
.main-content {
  @apply md:pl-[240px]; /* 展開時 */
  @apply md:pl-[72px];  /* 折りたたみ時 */
}
```

---

## ダークモード対応

現在はライトモードのみですが、将来的にダークモード対応する場合：

```css
/* ダークモード用CSS変数 */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #0F172A;
    --color-surface: #1E293B;
    --color-text-primary: #F8FAFC;
    --color-text-secondary: #94A3B8;
  }
}
```

---

## 背景パターン

```html
<!-- グリッドパターン -->
<div class="bg-grid" />

<!-- ドットパターン -->
<div class="bg-dots" />

<!-- 放射グラデーション -->
<div class="bg-gradient-radial" />
```

---

*最終更新: 2026年1月*

