// ============================================
// ドヤAI 共通LPデザインキット — プリミティブ
// ブランド青 #0066ff を主役、サービス別アクセントは CSS変数 --lp-accent で注入。
// 絵文字は使わずアイコンは Material Symbols Outlined のみ（ブランド規約）。
// サーバーコンポーネントとして動作（アニメはCSSクラスのみ）。
// ============================================
import React from 'react'

/** Material Symbols アイコン（LP内のアイコンは必ずこれ経由。絵文字禁止） */
export function Sym({ name, size = 20, className = '', fill = false, style }: { name: string; size?: number; className?: string; fill?: boolean; style?: React.CSSProperties }) {
  return (
    <span
      className={`material-symbols-outlined leading-none ${className}`}
      style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1" : undefined, ...style }}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}

/** サービス別アクセントを CSS変数として下位に配布する style を生成 */
export function accentVars(accent?: string): React.CSSProperties {
  return { ['--lp-accent' as string]: accent || '#0066ff' }
}

/** 背景の淡い浮遊ドット（世界観の統一・主張しすぎない） */
export function BgDots() {
  const dots = [
    { t: '12%', l: '8%', s: 14, c: 'rgba(0,102,255,0.10)', d: 0 },
    { t: '22%', l: '86%', s: 20, c: 'var(--lp-accent)', d: 0.6, o: 0.14 },
    { t: '54%', l: '5%', s: 10, c: 'rgba(0,102,255,0.10)', d: 1.1 },
    { t: '66%', l: '92%', s: 16, c: 'rgba(0,102,255,0.08)', d: 0.3 },
    { t: '38%', l: '52%', s: 8, c: 'var(--lp-accent)', d: 1.5, o: 0.12 },
    { t: '82%', l: '30%', s: 12, c: 'rgba(0,102,255,0.06)', d: 0.9 },
  ]
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {dots.map((d, i) => (
        <span
          key={i}
          className="animate-float absolute rounded-full"
          style={{ top: d.t, left: d.l, width: d.s, height: d.s, background: d.c, opacity: d.o ?? 1, animationDelay: `${d.d}s` }}
        />
      ))}
    </div>
  )
}

/** セクション見出し（アイキャッチ小ラベル＋見出し＋リード） */
export function SectionHeading({ eyebrow, title, lead, align = 'center' }: { eyebrow?: string; title: React.ReactNode; lead?: string; align?: 'center' | 'left' }) {
  const a = align === 'center' ? 'text-center mx-auto' : 'text-left'
  return (
    <div className={`${a} max-w-2xl mb-12`}>
      {eyebrow && (
        <span
          className="inline-block text-xs font-black tracking-widest uppercase mb-3 px-3 py-1 rounded-full"
          style={{ color: 'var(--lp-accent)', background: 'color-mix(in srgb, var(--lp-accent) 12%, transparent)' }}
        >
          {eyebrow}
        </span>
      )}
      <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 leading-tight">{title}</h2>
      {lead && <p className="mt-4 text-base md:text-lg text-slate-500 font-medium leading-relaxed">{lead}</p>}
    </div>
  )
}
