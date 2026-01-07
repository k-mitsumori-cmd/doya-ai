# 🎬 アニメーション仕様

全サービス共通のアニメーション実装リファレンスです。

---

## 目次

1. [モード定義](#モード定義)
2. [共通アニメーション](#共通アニメーション)
3. [Party演出](#party演出)
4. [LoadingOverlayコンポーネント](#loadingoverlayコンポーネント)
5. [CSS/Tailwind定義](#csstailwind定義)
6. [Framer Motion実装例](#framer-motion実装例)

---

## モード定義

```typescript
export type MotionMode = 'party' | 'minimal'
```

---

## 共通アニメーション

### マウント（初期表示）

| 要素 | アニメーション | 時間 |
|------|--------------|------|
| ページ全体 | `opacity 0 → 1` | 0.25s / ease-out |
| メインコンテナ | `y 12 → 0` + `opacity 0 → 1` | 0.3s / ease-out |
| ナビ要素 | delay 0.1s でフェードイン | 0.2s / ease-out |

### 出現順（stagger）

- 出現順：**見出し → 説明 → 入力 → ボタン**
- `staggerChildren: 0.06`

### CTA操作感

| 状態 | 効果 | 時間 |
|------|------|------|
| hover | `scale 1 → 1.02` | 0.15s / ease-out |
| tap | `scale 0.98` | 0.1s |
| party + hover | + `rotate: -0.4deg` | - |
| party + tap | + `rotate: 0.8deg` | - |

### 画面遷移

| 要素 | アニメーション |
|------|--------------|
| 新画面 | `x 16 → 0` / `opacity 0 → 1` |
| 旧画面 | `opacity 1 → 0` |
| duration | 0.25〜0.35s |
| ease | easeOut |
| spring | minimal: 不使用 / party: 任意 |

---

## Party演出

### マスコット（進捗連動）

```typescript
type OverlayMood = 'idle' | 'search' | 'think' | 'happy'
```

| 進捗 | mood | 動き |
|------|------|------|
| `< 35%` | `search` | 小刻み上下＋揺れ |
| `< 70%` | `think` | ゆっくり上下 |
| `>= 70%` | `happy` | 左右スイング＋軽い回転 |

### 紙吹雪

- ライブラリ: `canvas-confetti`
- 発火タイミング: 完了時

---

## マスコット素材

- 参照パス：`/persona/mascot.svg`

```typescript
import confetti from 'canvas-confetti'

confetti({
  particleCount: 100,
  spread: 70,
  origin: { y: 0.6 },
})
```

### 動く背景

- `pointer-events: none` 必須
- ブロブアニメーション（rotate / y oscillation）

---

## LoadingOverlayコンポーネント

```typescript
export type LoadingOverlayProps = {
  open: boolean
  mode: MotionMode
  progress: number          // 0-100
  stageText: string
  mood: OverlayMood
  steps: { label: string; threshold: number }[]
}
```

### 使用例

```tsx
<LoadingOverlay
  open={isLoading}
  mode="party"
  progress={progress}
  stageText="生成中..."
  mood={mood}
  steps={[
    { label: '解析', threshold: 25 },
    { label: '生成', threshold: 50 },
    { label: '仕上げ', threshold: 75 },
    { label: '完了', threshold: 100 },
  ]}
/>
```

---

## CSS/Tailwind定義

### キーフレーム

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
  50% { box-shadow: 0 0 40px rgba(59, 130, 246, 0.5); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### ユーティリティクラス

```css
.animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
.animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
.animate-fade-in-down { animation: fadeInDown 0.5s ease-out forwards; }
.animate-scale-in { animation: scaleIn 0.3s ease-out forwards; }
.animate-slide-in-right { animation: slideInRight 0.5s ease-out forwards; }
.animate-float { animation: float 3s ease-in-out infinite; }
.animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }

.animation-delay-100 { animation-delay: 100ms; }
.animation-delay-200 { animation-delay: 200ms; }
.animation-delay-300 { animation-delay: 300ms; }
.animation-delay-400 { animation-delay: 400ms; }
.animation-delay-500 { animation-delay: 500ms; }
```

### Tailwind config

```typescript
animation: {
  'fade-in': 'fadeIn 0.5s ease-out forwards',
  'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
  'fade-in-down': 'fadeInDown 0.5s ease-out forwards',
  'scale-in': 'scaleIn 0.3s ease-out forwards',
  'slide-in-right': 'slideInRight 0.5s ease-out forwards',
  'float': 'float 3s ease-in-out infinite',
  'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
  'shimmer': 'shimmer 2s infinite',
  'spin-slow': 'spin 8s linear infinite',
},
```

---

## Framer Motion実装例

### Stagger Container

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
}
```

### CTAボタン

```tsx
<motion.button
  whileHover={{ scale: 1.02, rotate: mode === 'party' ? -0.4 : 0 }}
  whileTap={{ scale: 0.98, rotate: mode === 'party' ? 0.8 : 0 }}
  transition={{ duration: 0.15, ease: 'easeOut' }}
>
  生成する
</motion.button>
```

### マスコット

```tsx
const mascotVariants = {
  search: {
    y: [0, -4, 0],
    rotate: [-2, 2, -2],
    transition: { repeat: Infinity, duration: 0.5 },
  },
  think: {
    y: [0, -8, 0],
    transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
  },
  happy: {
    x: [-4, 4, -4],
    rotate: [-5, 5, -5],
    transition: { repeat: Infinity, duration: 0.8 },
  },
}
```

### 動く背景

```tsx
<motion.div
  className="fixed inset-0 pointer-events-none z-0"
  animate={{
    background: [
      'radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)',
      'radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
    ],
  }}
  transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
/>
```

---

## 参考実装

- マスコット素材: `public/persona/mascot.svg`

---

*最終更新: 2026年1月*
