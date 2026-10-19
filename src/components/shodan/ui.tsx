'use client'

// ドヤ商談準備 共通UIパーツ（ドヤAIデザイン言語：ブランド紫 #7f19e6・ドヤくん・浮遊ドット）
import React from 'react'
import { Briefcase, Rocket, Settings, Users, type LucideIcon } from 'lucide-react'
import { useUiNext } from '@/components/shell/ui-next-context'

export const BRAND = '#7f19e6'

// 公式マスコット「ドヤくん」表情差分（共有素材 /character/*.png）
export const CHAR = {
  hello: '/character/hello.png',
  thumbsup: '/character/thumbsup.png',
  point: '/character/point.png',
  thinking: '/character/thinking.png',
  present: '/character/present.png',
  success: '/character/success.png',
  working: '/character/working.png',
  focus: '/character/focus.png',
  surprise: '/character/surprise.png',
  love: '/character/love.png',
  error: '/character/error.png',
  jump: '/character/jump.png',
} as const
export type Mood = keyof typeof CHAR

/** ドヤくん表示（ふわふわ浮遊） */
export function DoyaKun({ mood = 'hello', size = 96, float = true, className = '', delay = 0 }: { mood?: Mood; size?: number; float?: boolean; className?: string; delay?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={CHAR[mood]}
      alt="ドヤくん"
      width={size}
      height={size}
      className={`${float ? 'bear-float' : ''} ${className} select-none pointer-events-none drop-shadow-[0_8px_20px_rgba(127,25,230,0.18)]`}
      style={{ width: size, height: size, objectFit: 'contain', animationDelay: `${delay}s` }}
    />
  )
}

/** 背景の浮遊ドット（ポップな世界観） */
export function BgDots() {
  const dots = [
    { t: '12%', l: '8%', s: 16, c: 'rgba(127,25,230,0.12)', d: 0 },
    { t: '22%', l: '88%', s: 22, c: 'rgba(251,191,36,0.22)', d: 0.6 },
    { t: '52%', l: '5%', s: 12, c: 'rgba(217,70,239,0.16)', d: 1.1 },
    { t: '64%', l: '92%', s: 18, c: 'rgba(127,25,230,0.12)', d: 0.3 },
    { t: '38%', l: '50%', s: 10, c: 'rgba(56,189,248,0.18)', d: 1.5 },
    { t: '80%', l: '30%', s: 14, c: 'rgba(127,25,230,0.08)', d: 0.9 },
    { t: '10%', l: '60%', s: 10, c: 'rgba(217,70,239,0.10)', d: 1.8 },
  ]
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {dots.map((d, i) => (
        <span
          key={i}
          className="animate-float absolute rounded-full"
          style={{ top: d.t, left: d.l, width: d.s, height: d.s, background: d.c, animationDelay: `${d.d}s` }}
        />
      ))}
    </div>
  )
}

/** ブランドマーク（🎯＋ドヤ商談準備） */
export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-xl'
  return (
    <span className={`inline-flex items-center gap-2 font-black ${px}`}>
      <span className="grid place-items-center rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/25" style={{ width: '1.6em', height: '1.6em' }}>🎯</span>
      <span className="text-slate-900">ドヤ商談準備</span>
    </span>
  )
}

/** 新しい見た目で使う lucide のアイコン（PageHeader の icon は Material Symbols の名前で受けるので、ここで置き換える） */
const NEXT_ICON: Record<string, LucideIcon> = {
  rocket_launch: Rocket,
  settings: Settings,
  business_center: Briefcase,
  group: Users,
}

/**
 * ページの見出し。新しい見た目（UI 品質 §5.1・S-57）のときは h2（h1 は枠の ToolFrame が出す）。
 * ⚠️ 新しい見た目でないときは、今までどおりの h1 と className のまま。
 */
export function ShodanHeading({ children, className = 'text-2xl font-black text-slate-900' }: { children: React.ReactNode; className?: string }) {
  const uiNext = useUiNext()
  if (uiNext) return <h2 className={className.replace(/\btext-2xl\b/, 'text-xl').replace(/\bfont-black\b/, 'font-bold')}>{children}</h2>
  return <h1 className={className}>{children}</h1>
}

/** 画面共通ヘッダ（アイコン＋タイトル＋サブ。任意でドヤくん） */
export function PageHeader({ icon, title, subtitle, mood }: { icon: string; title: string; subtitle?: string; mood?: Mood }) {
  const uiNext = useUiNext()
  // 新しい見た目: ブランドの青の lucide アイコンと h2。旧来のマスコット画像・紫のグラデーションは出さない
  if (uiNext) {
    const Icon = NEXT_ICON[icon] ?? Briefcase
    return (
      <div className="mb-6 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0066ff]/10 text-[#0066ff]"><Icon className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 mb-6">
      {mood ? (
        <DoyaKun mood={mood} size={52} float={false} />
      ) : (
        <span className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white shadow-md shadow-purple-500/25">
          <span className="material-symbols-outlined">{icon}</span>
        </span>
      )}
      <div className="min-w-0">
        <h1 className="text-2xl font-black text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm font-bold text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

/** サイトのスクリーンショット表示（og:image優先、無ければmShotsで生成。失敗時はグラデ+アイコン） */
export function SiteShot({ url, ogImage, className = '', label }: { url: string; ogImage?: string | null; className?: string; label?: string }) {
  const [src, setSrc] = React.useState(
    ogImage || `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=900`
  )
  const [failed, setFailed] = React.useState(false)
  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-purple-100 to-fuchsia-100 ${className}`}>
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={label || url}
          className="w-full h-full object-cover object-top"
          loading="lazy"
          onError={() => {
            // og:image が死んでいたら mShots にフォールバック、それも失敗ならプレースホルダ
            const ms = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=900`
            if (src !== ms) setSrc(ms)
            else setFailed(true)
          }}
        />
      ) : (
        <div className="w-full h-full grid place-items-center text-purple-400">
          <span className="material-symbols-outlined" style={{ fontSize: 40 }}>language</span>
        </div>
      )}
      {label && <div className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] font-bold px-2 py-1 truncate">{label}</div>}
    </div>
  )
}

/** セクションカード見出し */
export function sym(name: string, sizePx = 20) {
  return <span className="material-symbols-outlined" style={{ fontSize: sizePx }}>{name}</span>
}
