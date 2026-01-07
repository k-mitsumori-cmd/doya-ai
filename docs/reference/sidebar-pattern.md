# 📐 サイドバー実装パターン

ドヤAI全サービスで統一されたサイドバーの実装パターンです。

---

## 目次

1. [サイドバー構造](#サイドバー構造)
2. [必須要素](#必須要素)
3. [状態管理](#状態管理)
4. [スタイリング](#スタイリング)
5. [実装例](#実装例)
6. [共通コンポーネント](#共通コンポーネント)

---

## サイドバー構造

```
┌─────────────────────────────┐
│  🎨 サービス名              │ ← ロゴ + タイトル
├─────────────────────────────┤
│  📍 URL自動生成      [HOT]  │ ← ナビゲーション
│     バナー作成              │
│     AIチャット              │
│     ギャラリー              │
│     履歴                    │
│     プラン・使用量          │
├─────────────────────────────┤
│  🚀 生成し放題中！          │ ← キャンペーンバナー
│     残り 45:30              │    （条件付き表示）
├─────────────────────────────┤
│  ⚡ プラン案内              │ ← プランバナー
│     現在: FREE              │    （通常時表示）
│     [PROを始める]           │
├─────────────────────────────┤
│  🔲 他のツールを使う ▼      │ ← ToolSwitcherMenu
├─────────────────────────────┤
│  ❓ お問い合わせ            │ ← サポートリンク
├─────────────────────────────┤
│  👤 ユーザー名       [↪]    │ ← プロフィール + ログアウト
│     FREE プラン             │
└─────────────────────────────┘
    [◀] ← 折りたたみボタン（デスクトップのみ）
```

---

## 必須要素

### 1. ロゴ + サービス名

```tsx
<div className="px-4 py-5 flex items-center gap-2">
  <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm backdrop-blur-md">
    <Sparkles className="w-5 h-5 text-white" />
  </div>
  <AnimatePresence>
    {showLabel && (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        className="overflow-hidden"
      >
        <h1 className="text-lg font-black text-white tracking-tighter leading-none">
          ドヤ○○AI
        </h1>
        <p className="text-[10px] font-bold text-white/70 mt-0.5">
          サブタイトル
        </p>
      </motion.div>
    )}
  </AnimatePresence>
</div>
```

### 2. ナビゲーションリンク

```tsx
type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  hot?: boolean
  badge?: string | number
}

const NAV_ITEMS: NavItem[] = [
  { href: '/service', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/service/create', label: '新規作成', icon: Plus, hot: true },
  { href: '/service/history', label: '履歴', icon: Clock },
  { href: '/service/pricing', label: 'プラン', icon: CreditCard },
]

// ナビリンクコンポーネント
const NavLink = ({ item }: { item: NavItem }) => {
  const active = isActive(item.href)
  const Icon = item.icon

  return (
    <Link href={item.href}>
      <motion.div
        whileHover={{ x: 4 }}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group ${
          active
            ? 'bg-white/15 text-white'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
      >
        <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
        
        <AnimatePresence>
          {showLabel && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="text-sm font-semibold whitespace-nowrap overflow-hidden"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {/* HOTバッジ */}
        {item.hot && showLabel && (
          <span className="ml-auto px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-[10px] font-bold text-white rounded-md shadow-sm">
            HOT
          </span>
        )}

        {/* アクティブインジケーター */}
        {active && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full"
          />
        )}
      </motion.div>
    </Link>
  )
}
```

### 3. キャンペーンバナー（1時間生成し放題）

```tsx
const FreeHourBanner = () => {
  if (!isFreeHourActive || freeHourRemainingMs <= 0) return null
  if (!showLabel) return null

  return (
    <div className="mx-3 mt-3 p-3 rounded-xl bg-gradient-to-br from-amber-400 via-orange-400 to-red-400 border border-amber-300/50 relative overflow-hidden shadow-lg shadow-amber-500/20">
      <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-white/10 pointer-events-none" />
      <div className="relative z-10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
          <span className="text-xl">🚀</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white drop-shadow-sm">生成し放題中！</p>
          <p className="text-[10px] text-white/80 font-bold">全機能解放</p>
        </div>
        <div className="px-2.5 py-1.5 bg-white/30 rounded-lg backdrop-blur-sm flex-shrink-0">
          <p className="text-sm font-black text-white tabular-nums drop-shadow-sm">
            {formatRemainingTime(freeHourRemainingMs)}
          </p>
        </div>
      </div>
    </div>
  )
}
```

### 4. プラン案内バナー

```tsx
const PlanBanner = () => {
  if (isFreeHourActive && freeHourRemainingMs > 0) return null
  if (!showLabel) return null

  return (
    <div className="mx-3 my-2 p-3 rounded-xl bg-gradient-to-br from-white/20 to-white/5 border border-white/20 backdrop-blur-md relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-md flex-shrink-0">
            <Zap className="w-4 h-4 text-blue-600 fill-blue-600" />
          </div>
          <p className="text-xs font-black text-white">プラン案内</p>
        </div>
        <p className="text-[11px] text-white font-bold leading-relaxed mb-1">
          現在：{planLabel}
        </p>
        <Link
          href="/service/pricing"
          className="mt-2 w-full py-2 bg-white text-blue-600 text-[11px] font-black rounded-lg hover:bg-blue-50 transition-colors shadow-md block text-center"
        >
          PROを始める
        </Link>
      </div>
    </div>
  )
}
```

### 5. ToolSwitcherMenu

```tsx
<ToolSwitcherMenu
  currentTool="banner"  // 'persona' | 'banner' | 'writing'
  showLabel={showLabel}
  isCollapsed={isCollapsed}
  className="px-3 pb-2"
/>
```

### 6. お問い合わせリンク

```tsx
<div className="px-3 pb-2">
  <a
    href={SUPPORT_CONTACT_URL}
    target="_blank"
    rel="noreferrer"
    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 transition-colors text-white ${
      isCollapsed ? 'justify-center' : ''
    }`}
    title="お問い合わせ"
  >
    <HelpCircle className="w-4 h-4 text-white flex-shrink-0" />
    <AnimatePresence>
      {showLabel && (
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
        >
          <div className="text-xs font-bold leading-none">お問い合わせ</div>
        </motion.div>
      )}
    </AnimatePresence>
  </a>
</div>
```

### 7. ユーザープロフィール

```tsx
<div className="p-3 border-t border-white/5 bg-blue-700/30">
  <div className={`flex items-center gap-2 ${isCollapsed ? 'justify-center' : ''}`}>
    <Link
      href="/service/settings"
      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex-1 min-w-0"
    >
      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-inner border border-white/10">
        {session?.user?.image ? (
          <img src={session.user.image} alt="User" className="w-full h-full rounded-full object-cover" />
        ) : (
          <User className="w-4 h-4 text-white" />
        )}
      </div>
      <AnimatePresence>
        {showLabel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">
              {session?.user?.name || 'ゲスト'}
            </p>
            <p className="text-[10px] font-bold text-white/60 truncate">
              {planLabel}プラン
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Link>
    {showLabel && (
      <button
        onClick={requestLogout}
        className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        title="ログアウト"
      >
        <LogOut className="w-4 h-4" />
      </button>
    )}
  </div>
</div>
```

### 8. 折りたたみボタン

```tsx
{!isMobile && (
  <button
    onClick={toggle}
    className="absolute -right-3 top-24 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors border border-gray-100 z-10"
  >
    {isCollapsed ? (
      <ChevronRight className="w-4 h-4" />
    ) : (
      <ChevronLeft className="w-4 h-4" />
    )}
  </button>
)}
```

---

## 状態管理

### Props

```tsx
interface SidebarProps {
  isCollapsed?: boolean          // 折りたたみ状態（制御コンポーネント用）
  onToggle?: (collapsed: boolean) => void
  forceExpanded?: boolean        // 強制展開（モバイル用）
  isMobile?: boolean             // モバイル表示
}
```

### ラベル表示ロジック

```tsx
const showLabel = isMobile || !isCollapsed
```

### アクティブ判定

```tsx
const isActive = (href: string) => {
  if (href === '/service') return pathname === '/service'
  return pathname.startsWith(href)
}
```

### LocalStorage永続化

```tsx
// レイアウト側で管理
React.useEffect(() => {
  const saved = localStorage.getItem('sidebar-collapsed')
  if (saved !== null) {
    setIsCollapsed(saved === 'true')
  }
}, [])

const handleToggle = React.useCallback((collapsed: boolean) => {
  setIsCollapsed(collapsed)
  localStorage.setItem('sidebar-collapsed', String(collapsed))
}, [])
```

---

## スタイリング

### サイドバー本体

```tsx
<motion.aside
  initial={false}
  animate={{
    width: isCollapsed ? 72 : 240,
  }}
  transition={{ duration: 0.2, ease: 'easeInOut' }}
  className={`${isMobile ? 'relative' : 'fixed left-0 top-0'} h-screen bg-[#2563EB] flex flex-col z-50 shadow-xl`}
>
```

### サービス別背景色

| サービス | 背景色クラス |
|----------|--------------|
| ドヤバナーAI | `bg-[#2563EB]` (Blue) |
| ドヤライティングAI | `bg-gradient-to-b from-emerald-600 via-green-600 to-teal-700` |
| ドヤペルソナAI | `bg-gradient-to-b from-purple-600 via-violet-600 to-purple-700` |

---

## 実装例

完全な実装例は以下を参照：

- `src/components/DashboardSidebar.tsx` （ドヤバナーAI）
- `src/components/SeoSidebar.tsx` （ドヤライティングAI）
- `src/components/PersonaSidebar.tsx` （ドヤペルソナAI）

---

## 共通コンポーネント

### ToolSwitcherMenu

`src/components/ToolSwitcherMenu.tsx`

3つのツール間を切り替えるドロップダウンメニュー。

### LogoutToastListener

`src/components/LogoutToastListener.tsx`

ログアウト後のトースト表示を管理。

### SidebarTour

`src/components/SidebarTour.tsx`

初回ログイン時のサイドバーツアー。

---

*最終更新: 2026年1月*

