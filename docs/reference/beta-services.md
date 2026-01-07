# 🚧 製作中サービス（ベータ版）管理ガイド

製作中のサービスをベータ版として公開する際の管理方法です。

---

## 目次

1. [ベータ版サービスの定義](#ベータ版サービスの定義)
2. [表示ルール](#表示ルール)
3. [実装方法](#実装方法)
4. [ベータ版マークの表示](#ベータ版マークの表示)
5. [ベータ版から正式版への移行](#ベータ版から正式版への移行)

---

## ベータ版サービスの定義

### ステータス

```typescript
// src/lib/services.ts
{
  id: 'lp-site',
  name: 'ドヤサイト',
  status: 'beta',  // 製作中・ベータ版
  badge: 'ベータ版',
  // ...
}
```

### ベータ版の条件

以下の条件を満たすサービスはベータ版として扱います：

1. **基本機能は動作する**が、まだ改善が必要
2. **UI/UXが未完成**または調整中
3. **ドキュメントが不完全**
4. **一般ユーザーへの公開は可能**だが、注意喚起が必要
5. **他サービスのサイドバーには表示しない**（自分自身のサイドバーのみ表示）

---

## 表示ルール

### ✅ 表示する場所

1. **サービス自身のサイドバー**
   - ツール切替メニューに表示（自分自身を含む）
   - ロゴ横に「ベータ版」バッジを表示

2. **サービス自身のページ**
   - ページタイトル横に「ベータ版」バッジを表示

3. **トップページ（ポータル）**
   - サービス一覧に表示（ベータ版バッジ付き）

### ❌ 表示しない場所

1. **他サービスのサイドバー**
   - ToolSwitcherMenuに表示しない
   - 他のサービスのサイドバーからは見えないようにする

2. **サービス一覧ナビゲーション（他サービス内）**
   - 他のサービスのサイドバーからは遷移できない

---

## 実装方法

### 1. サービス定義

```typescript
// src/lib/services.ts
{
  id: 'lp-site',
  status: 'beta',
  badge: 'ベータ版',
  // ...
}
```

### 2. ToolSwitcherMenuの修正

製作中のサービス（ベータ版）は、**そのサービス自身のサイドバー**以外では表示しない。

```typescript
// src/components/ToolSwitcherMenu.tsx

// ベータ版でないサービスのみを表示
const TOOLS: Array<{
  id: ToolId
  href: string
  title: string
  description: string
  icon: React.ElementType
  iconBgClassName: string
  isBeta?: boolean  // ベータ版フラグ
}> = [
  {
    id: 'persona',
    // ...
    isBeta: false,
  },
  {
    id: 'banner',
    // ...
    isBeta: false,
  },
  {
    id: 'writing',
    // ...
    isBeta: false,
  },
  // ベータ版サービスは通常のサイドバーには含めない
  // {
  //   id: 'lp-site',
  //   isBeta: true,  // 自分自身のサイドバーでのみ表示
  // }
]

// フィルタリング（オプション）
// const visibleTools = TOOLS.filter(tool => !tool.isBeta || currentTool === tool.id)
```

### 3. サイドバー実装

**ベータ版サービス自身のサイドバー**では、自分自身を含めて全て表示する。

```typescript
// src/components/LpSiteSidebar.tsx

// 自分自身のサイドバーでは、ベータ版も含めて全ツールを表示
const TOOLS_FOR_LP_SITE = [
  ...TOOLS,  // 通常のツール
  {
    id: 'lp-site',
    href: '/lp-site',
    title: 'ドヤサイト',
    description: 'LP自動生成',
    icon: Globe,
    iconBgClassName: 'bg-gradient-to-br from-teal-500 to-cyan-500',
    isBeta: true,
  },
]
```

---

## ベータ版マークの表示

### サイドバー

```tsx
// ロゴ横に表示
<div className="flex items-center gap-2">
  <h1 className="text-lg font-black text-white">ドヤサイト</h1>
  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-md">
    ベータ版
  </span>
</div>
```

### ページタイトル

```tsx
// ページタイトル横に表示
<div className="flex items-center gap-3">
  <h1 className="text-4xl font-black text-slate-900">ドヤサイト</h1>
  <span className="px-2 py-1 bg-amber-500 text-white text-xs font-black rounded-md shadow-sm">
    ベータ版
  </span>
</div>
```

### ツール切替メニュー（自分自身のサイドバー内）

```tsx
// ベータ版バッジを表示
<div className="flex items-center gap-1.5">
  <p className="text-sm font-black text-slate-900">ドヤサイト</p>
  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-md">
    ベータ版
  </span>
</div>
```

---

## ベータ版から正式版への移行

### 移行手順

1. **サービス定義の更新**

```typescript
// src/lib/services.ts
{
  id: 'lp-site',
  status: 'active',  // beta → active に変更
  badge: undefined,  // バッジを削除
  // ...
}
```

2. **ToolSwitcherMenuに追加**

```typescript
// src/components/ToolSwitcherMenu.tsx
const TOOLS = [
  // ... 既存のツール
  {
    id: 'lp-site',
    href: '/lp-site',
    title: 'ドヤサイト',
    description: 'LP自動生成',
    icon: Globe,
    iconBgClassName: 'bg-gradient-to-br from-teal-500 to-cyan-500',
  },
]
```

3. **全てのサイドバーで表示**

- DashboardSidebar.tsx
- SeoSidebar.tsx
- PersonaSidebar.tsx
- その他全てのサイドバー

4. **ベータ版バッジの削除**

- サイドバーのロゴ横
- ページタイトル横
- ToolSwitcherMenu内

5. **テスト**

- 全てのサイドバーからツール切替ができることを確認
- ベータ版バッジが表示されないことを確認

---

## チェックリスト

### 新規ベータ版サービス追加時

- [ ] `src/lib/services.ts` で `status: 'beta'` を設定
- [ ] `badge: 'ベータ版'` を追加
- [ ] サービス自身のサイドバーにベータ版バッジを表示
- [ ] サービス自身のページにベータ版バッジを表示
- [ ] **他サービスのサイドバーには表示しない**（ToolSwitcherMenuに含めない）
- [ ] `getActiveServices()` でベータ版も取得できることを確認

### ベータ版→正式版移行時

- [ ] `status: 'active'` に変更
- [ ] `badge` を削除または `undefined` に設定
- [ ] 全サイドバーのToolSwitcherMenuに追加
- [ ] ベータ版バッジを全箇所から削除
- [ ] 動作確認

---

## 現在のベータ版サービス

| サービスID | サービス名 | ステータス | 備考 |
|-----------|----------|----------|------|
| `lp-site` | ドヤサイト | `beta` | LP自動生成ツール |

---

*最終更新: 2026年1月*

