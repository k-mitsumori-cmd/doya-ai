# 06. UIコンポーネント・デザインパターン

## ブランドガイドライン

| 項目 | 値 |
|------|-----|
| メインカラー | `#7f19e6` (紫) |
| アイコン | Material Symbols Outlined |
| フォント | Inter + Noto Sans JP |
| 角丸 | `rounded-xl` 〜 `rounded-3xl` |
| アニメーション | Framer Motion |

## Tailwind カスタム設定

### カラー
```typescript
brand: {
  blue: '#3B82F6',
  purple: '#8B5CF6',
  pink: '#EC4899',
}
```

### アニメーション
```
fade-in, fade-in-up, fade-in-down, scale-in, slide-in-right,
float, pulse-glow, shimmer, spin-slow
```

### グロー効果
```
glow-sm, glow-md, glow-lg, glow-purple, glow-pink
```

### 背景パターン
```
bg-grid-pattern, bg-dots-pattern
```

## レイアウト構成

### ルートレイアウト (`src/app/layout.tsx`)
- `Providers` (NextAuth SessionProvider)
- `GoogleTagManager`
- `LogoutToastListener`
- `PlanUpdatedListener`

### サービス別レイアウト

| サービス | レイアウト | サイドバー |
|---------|----------|----------|
| Banner + SEO | `DashboardLayout` | `DashboardSidebar` |
| Interview | `InterviewLayout` (components/interview/) | `InterviewSidebar` |
| Tenkai | `TenkaiLayout` (components/tenkai/) | `TenkaiSidebar` |
| Persona | `PersonaAppLayout` | `PersonaSidebar` |
| Shindan | `ShindanAppLayout` | `ShindanSidebar` |

### サイドバー共通構造

すべてのサイドバーは以下の共通構造:
```
┌─────────────────────┐
│ ロゴ + サービス名      │
├─────────────────────┤
│ ナビゲーション項目      │
│ ├─ メイン機能 (HOT)   │
│ ├─ 履歴/一覧         │
│ └─ 設定/プラン        │
├─────────────────────┤
│ ツール切り替えメニュー   │
│ (他サービスへのリンク)   │
├─────────────────────┤
│ プラン案内バナー        │
│ (現在プラン → PRO)    │
├─────────────────────┤
│ ユーザー情報           │
│ ├─ ログイン/ログアウト  │
│ └─ ヘルプリンク        │
└─────────────────────┘
```

### サイドバー機能
- **折りたたみ**: PC では展開/折りたたみ切り替え
- **モバイル**: 常に展開表示
- **アクティブ表示**: `layoutId` による Framer Motion アニメーション
- **1時間生成し放題**: 残り時間リアルタイム表示 (1秒更新)

### サイドバー共通コンポーネント (`src/components/sidebar/`)

5つのサイドバーの共通パーツを `SidebarTheme` 型でパラメータ化:

| ファイル | 説明 |
|---------|------|
| `types.ts` | `SidebarTheme`, `NavItem`, `SidebarProps` 型定義 |
| `themes.ts` | 5テーマプリセット: dashboard(blue), seo(emerald), persona(purple), shindan(teal), interview(brand-purple) |
| `useSidebarState.ts` | 折りたたみ状態管理（controlled + uncontrolled対応） |
| `useFreeHour.ts` | 1時間生成し放題タイマー + `formatRemainingTime` |
| `SidebarShell.tsx` | `motion.aside` ラッパー（幅アニメーション: 72px ↔ 240px） |
| `SidebarNavLink.tsx` | ナビリンク（テーマ色・HOT/badgeバッジ・`data-tour-nav`対応） |
| `SidebarSectionTitle.tsx` | セクション見出し |
| `SidebarCollapseToggle.tsx` | 折りたたみボタン |
| `SidebarBrandingFooter.tsx` | フッターブランド名 |
| `SidebarHelpContact.tsx` | お問い合わせボタン |
| `SidebarLogoSection.tsx` | ロゴ + サービス名ヘッダー（サブタイトル対応） |
| `SidebarUserProfile.tsx` | ユーザー情報エリア（設定リンク・ログイン/ログアウト・renderExtra） |
| `SidebarLogoutDialog.tsx` | ログアウト確認ダイアログ |
| `SidebarFreeHourBanner.tsx` | 生成し放題バナー（コンパクト版） |
| `index.ts` | re-exports |

**ToolSwitcherMenu**: `getActiveServices()` で `status === 'active'` なサービスのみ動的に表示。

## コンポーネント一覧

### 共通コンポーネント

| コンポーネント | 説明 |
|-------------|------|
| `Providers` | NextAuth SessionProvider ラッパー |
| `GoogleTagManager` | GTM埋め込み |
| `ServiceNav` | サービス切り替えナビゲーション |
| `ToolSwitcherMenu` | サイドバー内ツール切り替え |
| `CheckoutButton` | Stripe決済ボタン |
| `FreeHourPopup` | 1時間生成し放題ポップアップ |
| `OnboardingModal` / `OnboardingWizard` | 初回案内 |
| `PromoBanner` | プロモーションバナー |
| `UsageLimitBanner` | 利用制限バナー |
| `UpgradeSuccessModal` | アップグレード成功モーダル |
| `LoadingProgress` | ローディング表示 |
| `SidebarTour` | サイドバーツアー |
| `MobileTourPopup` | モバイルツアー |
| `LogoutToastListener` | ログアウト通知 |
| `PlanUpdatedListener` | プラン更新通知 |
| `sidebar/*` | サイドバー共通コンポーネント群（上記参照） |

### インタビュー専用

| コンポーネント | 説明 |
|-------------|------|
| `InterviewLayout` | レイアウト (サイドバー + メイン) |
| `InterviewSidebar` | サイドバー |
| `InterviewUpsellModal` | アップセルモーダル (制限到達時) |
| `InterviewUpgradeCelebration` | PRO昇格お祝い |

### 診断専用

| コンポーネント | 説明 |
|-------------|------|
| `ShindanRadarChart` | 6軸レーダーチャート (Recharts) |
| `ScoreCard` | スコアカード |
| `BenchmarkChart` | 業界ベンチマーク比較 |
| `BottleneckPanel` | ボトルネック分析 |
| `RecommendationPanel` | 改善提案 |
| `PdfExportButton` | PDF書き出し |

## 共通UIパターン

### モーダル
```tsx
<AnimatePresence>
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
  >
    <motion.div
      initial={{ scale: 0.85, opacity: 0, y: 24 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-2xl max-w-md w-full"
    >
      {/* コンテンツ */}
    </motion.div>
  </motion.div>
</AnimatePresence>
```

### グラデーション背景
```tsx
<div className="bg-gradient-to-br from-[#7f19e6]/10 via-blue-500/5 to-transparent" />
```

### ナビリンクのアクティブ表示
```tsx
{active && (
  <motion.div
    layoutId="activeIndicator"
    className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full"
  />
)}
```

### トースト通知
```typescript
import toast from 'react-hot-toast'
toast.success('保存しました')
toast.error('エラーが発生しました')
```

### Material Symbols アイコン
```tsx
<span className="material-symbols-outlined text-[20px]">auto_awesome</span>
```

### Lucide React アイコン
```tsx
import { Sparkles, Clock, Settings } from 'lucide-react'
<Sparkles className="w-5 h-5" />
```
