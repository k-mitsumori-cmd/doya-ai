'use client'
// ============================================
// 戦略とデザインの方向を決める画面（BOOTH-CONCEPT-FLOW-2026-11-11.md 3〜4 章）
// ============================================
// 先に、出展の戦略（狙い・来てほしい人・通路から3秒で伝える一言・体験）を読み、
// 3つのデザインの方向（実写・大きな文字と色面・世界観）から1つを選んで確定する。確定するまで、画像は作れない。
// - 方向のカードには、型・名前・狙い・題材・色見本・見出しと、絵の作り方・素材・光の文、コードで描いた小さな見本を出す（AI を呼ばないので無料）
// - 見本は型ごとに見た目が違う（実写 = 写真の場面、大きな文字と色面 = 帯と円、世界観 = 光る立体）
// - 主色・暗色・差し色は、色を直せる。出どころ（読み取り・自動で調整・あなたが直した）を出す
// - 点検: 白い見出しが読めるか、暗い文字が読めるか、差し色と主色の見分けがつくか。足りないと確定できない
import { useId } from 'react'
import { Check, Palette, Pencil } from 'lucide-react'
import { ART_SPEC, ART_TYPES, checkKit, isHex, withDirection, withPaletteColor, type ArtDirection, type ArtType, type BoothDesignKit, type BoothStrategy } from '@/lib/tenjikai/design-kit'

const ROLES = [
  { key: 'primary', label: '主色', note: '見出しの帯と大きな面' },
  { key: 'dark', label: '暗色', note: '濃い面と、紙の上の文字' },
  { key: 'accent', label: '差し色', note: '小さな面だけ' },
] as const

const FROM_LABEL = { analysis: '読み取った色', derived: '自動で調整した色', user: 'あなたが直した色', default: '既定の色' } as const

const STRATEGY_ROWS = [
  { key: 'aim', label: '出展の狙い' },
  { key: 'audience', label: '来てほしい人' },
  { key: 'hook', label: '通路から3秒で伝える一言' },
  { key: 'experience', label: 'ブースで体験してもらうこと' },
] as const

/** 方向の見本（コードで描く。型ごとに作り方を変える。幅 120 × 高さ 160） */
export function DirectionSample({ kit, type }: { kit: BoothDesignKit; type: ArtType }) {
  const uid = useId().replace(/:/g, '')
  const W = 120, H = 160
  const p = kit.palette
  const head = H * kit.zones.headBandRatio
  const headBars = (
    <>
      <rect width={W} height={head} fill={p.primary} />
      <rect x={W * 0.1} y={head * 0.3} width={W * 0.62} height={head * 0.16} rx={2} fill={p.paper} />
      <rect x={W * 0.1} y={head * 0.56} width={W * 0.4} height={head * 0.12} rx={2} fill={p.paper} opacity={0.7} />
    </>
  )
  if (type === 'graphic') {
    const m = kit.motif
    const r = (Math.min(W, H) * m.circleDiameterRatio) / 2
    const bandH = H * m.bandHeightRatio
    const slope = Math.tan((m.bandAngleDeg * Math.PI) / 180) * W
    const cy = H * 0.62
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="大きな文字と色面の見本">
        <rect width={W} height={H} fill={p.paper} />
        <rect y={H * (1 - kit.zones.footBandRatio)} width={W} height={H * kit.zones.footBandRatio} fill={p.mist} />
        <polygon points={`0,${cy + slope / 2} ${W},${cy - slope / 2} ${W},${cy - slope / 2 + bandH} 0,${cy + slope / 2 + bandH}`} fill={p.accent} />
        <circle cx={W - r * 0.9} cy={cy + r * 0.5} r={r} fill={p.dark} />
        {headBars}
      </svg>
    )
  }
  if (type === 'photo') {
    // 写真の場面: 窓の自然光、ぼけた背景の丸、机と、後ろ姿の人物
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="実写の見本">
        <defs>
          <linearGradient id={`${uid}-w`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={p.mist} />
            <stop offset="1" stopColor={p.primary} stopOpacity="0.45" />
          </linearGradient>
          <filter id={`${uid}-b`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" /></filter>
        </defs>
        <rect width={W} height={H} fill={`url(#${uid}-w)`} />
        <g filter={`url(#${uid}-b)`} opacity="0.85">
          <circle cx={26} cy={head + 22} r={13} fill={p.paper} />
          <circle cx={62} cy={head + 14} r={9} fill={p.accent} opacity="0.7" />
          <circle cx={98} cy={head + 30} r={15} fill={p.paper} opacity="0.9" />
        </g>
        <rect y={H * 0.76} width={W} height={H * 0.24} fill={p.dark} opacity="0.9" />
        <circle cx={W * 0.42} cy={H * 0.55} r={11} fill={p.dark} />
        <path d={`M${W * 0.42 - 25},${H * 0.76} C${W * 0.42 - 25},${H * 0.6} ${W * 0.42 + 25},${H * 0.6} ${W * 0.42 + 25},${H * 0.76} Z`} fill={p.dark} />
        <rect x={W * 0.62} y={H * 0.7} width={30} height={5} rx={1.5} fill={p.paper} />
        {headBars}
      </svg>
    )
  }
  // world: 暗い空間に、光る立体
  const cx = W / 2, cy = H * 0.64, s = 22
  const top = `${cx},${cy - s} ${cx + s},${cy - s / 2} ${cx},${cy} ${cx - s},${cy - s / 2}`
  const left = `${cx - s},${cy - s / 2} ${cx},${cy} ${cx},${cy + s} ${cx - s},${cy + s / 2}`
  const right = `${cx + s},${cy - s / 2} ${cx},${cy} ${cx},${cy + s} ${cx + s},${cy + s / 2}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="世界観の見本">
      <defs>
        <radialGradient id={`${uid}-g`} cx="50%" cy="62%" r="60%">
          <stop offset="0" stopColor={p.primary} stopOpacity="0.9" />
          <stop offset="1" stopColor={p.dark} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${uid}-g)`} />
      <ellipse cx={cx} cy={cy + s + 10} rx={34} ry={6} fill="#000" opacity="0.3" />
      <polygon points={left} fill={p.primary} opacity="0.85" />
      <polygon points={right} fill={p.dark} opacity="0.9" />
      <polygon points={top} fill={p.mist} opacity="0.95" />
      <polyline points={`${cx - s},${cy - s / 2} ${cx},${cy - s} ${cx + s},${cy - s / 2}`} fill="none" stroke={p.accent} strokeWidth={1.6} />
      <polygon points={`${cx - 42},${cy - 30} ${cx - 34},${cy - 26} ${cx - 42},${cy - 22} ${cx - 50},${cy - 26}`} fill={p.accent} opacity="0.9" />
      <polygon points={`${cx + 40},${cy - 44} ${cx + 47},${cy - 40} ${cx + 40},${cy - 36} ${cx + 33},${cy - 40}`} fill={p.mist} opacity="0.8" />
      {headBars}
    </svg>
  )
}

export default function DesignKitStudio({ strategy, directions, recommended, kit, confirmed, onChange, onConfirm, onReopen, madeCount = 0 }: {
  strategy: BoothStrategy
  /** 3つの方向（型ごとに1つ） */
  directions: ArtDirection[]
  /** 出展の目的から、おすすめの型 */
  recommended: ArtType
  kit: BoothDesignKit
  confirmed: boolean
  onChange: (kit: BoothDesignKit) => void
  onConfirm: () => void
  onReopen: () => void
  /** 作り済みの面の数（方向を直すときの注意に使う） */
  madeCount?: number
}) {
  const checks = checkKit(kit)
  const allOk = checks.every((c) => c.ok)
  const d = kit.direction

  if (confirmed) {
    return (
      <section aria-label="戦略とデザインの方向" data-kit-state="confirmed" className="flex flex-wrap items-center gap-4 rounded-[var(--r)] border border-gray-200 bg-white px-5 py-4">
        <Palette className="h-5 w-5 flex-none text-doya-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-black text-ink">デザインの方向は、確定しています（{ART_SPEC[d.type].label}：{d.name}）</p>
          <p className="mt-0.5 text-[13px] text-[var(--sub)]">これから作る面・制作物・完成予想図は、すべてこの方向で作ります。</p>
        </div>
        <div className="flex items-center gap-1.5" aria-label="方向の色">
          {(['primary', 'dark', 'accent'] as const).map((k) => (
            <span key={k} className="h-7 w-7 rounded-full ring-2 ring-white" style={{ background: kit.palette[k], boxShadow: '0 0 0 1px rgba(16,22,51,.15)' }} title={`${k} ${kit.palette[k]}`} />
          ))}
        </div>
        <button type="button" onClick={onReopen} className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] border-2 border-doya-500 px-4 text-sm font-black text-doya-600">
          <Pencil className="h-4 w-4" aria-hidden /> 方向を直す
        </button>
      </section>
    )
  }

  return (
    <section aria-labelledby="kit-title" data-kit-state="editing" className="flex flex-col gap-5 rounded-[var(--r)] border-2 border-doya-200 bg-white p-5 md:p-6">
      <div>
        <h2 id="kit-title" className="text-[18px] font-bold leading-snug text-ink">戦略を確かめて、デザインの方向を選びます</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-[var(--sub)]">まず戦略を読み、次に3つの方向から1つを選んで確定します。確定した方向で、すべての面と完成予想図を作ります。この画面は、費用がかかりません。</p>
        {madeCount > 0 && <p className="mt-2 rounded-[var(--r-sm)] bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-900">すでに作った {madeCount} 面の画像は、前の方向で作られています。方向を変えたあとで作り直すと、新しい方向でそろいます。</p>}
      </div>

      <dl className="grid gap-3 rounded-[var(--r-sm)] bg-[var(--track)] p-4 sm:grid-cols-2" aria-label="出展の戦略">
        {STRATEGY_ROWS.map((r) => (
          <div key={r.key}>
            <dt className="text-[12px] font-bold text-[var(--sub)]">{r.label}</dt>
            <dd className="mt-0.5 text-[14px] font-bold leading-relaxed text-ink [text-wrap:pretty]">{strategy[r.key]}</dd>
          </div>
        ))}
      </dl>

      <div role="radiogroup" aria-label="デザインの方向" className="grid gap-3 lg:grid-cols-3">
        {ART_TYPES.map((type) => {
          const dir = directions.find((x) => x.type === type)
          if (!dir) return null
          const spec = ART_SPEC[type]
          const active = d.type === type
          const preview = withDirection(kit, dir)
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={active}
              data-direction={type}
              onClick={() => onChange(preview)}
              className={`flex gap-3 rounded-[var(--r-sm)] border-2 p-3 text-left transition-colors duration-150 lg:flex-col ${active ? 'border-doya-500 bg-doya-50' : 'border-gray-200 bg-white hover:border-doya-200'}`}
            >
              <span className="block w-24 flex-none overflow-hidden rounded-md border border-gray-200 lg:w-full"><DirectionSample kit={preview} type={type} /></span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-black text-white">{spec.label}</span>
                  {type === recommended && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-900">目的に合う</span>}
                  {active && <Check className="h-4 w-4 text-doya-600" aria-hidden />}
                </span>
                <span className="text-[15px] font-black leading-snug text-ink">{dir.name}</span>
                <span className="text-[13px] leading-relaxed text-ink">{dir.aim}</span>
                <span className="text-[12px] leading-relaxed text-[var(--sub)]">題材：{dir.subject}</span>
                <span className="text-[12px] leading-relaxed text-[var(--sub)]">見出し：{dir.headline.replace(/\n/g, ' ')}</span>
                <span className="text-[12px] leading-relaxed text-[var(--sub)]">絵の作り方：{spec.how}</span>
                <span className="text-[12px] leading-relaxed text-[var(--sub)]">素材：{spec.material}</span>
                <span className="text-[12px] leading-relaxed text-[var(--sub)]">光：{spec.light}</span>
                <span className="flex items-center gap-1.5" aria-label="色見本">
                  {(['primary', 'dark', 'accent'] as const).map((k) => (
                    <span key={k} className="h-5 w-5 rounded-full" style={{ background: kit.palette[k], boxShadow: '0 0 0 1px rgba(16,22,51,.15)' }} />
                  ))}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {ROLES.map((r) => {
          const v = kit.palette[r.key]
          const prov = kit.provenance[r.key]
          return (
            <div key={r.key} className="flex flex-col gap-1.5 rounded-[var(--r-sm)] border border-gray-200 p-3">
              <label htmlFor={`kit-${r.key}`} className="text-[14px] font-bold text-ink">{r.label}<span className="ml-2 text-[12px] font-medium text-[var(--sub)]">{r.note}</span></label>
              <div className="flex items-center gap-2">
                <input aria-label={`${r.label}の色を選ぶ`} type="color" value={v} onChange={(e) => onChange(withPaletteColor(kit, r.key, e.target.value))} className="h-11 w-11 flex-none cursor-pointer rounded-md border border-gray-300 bg-white p-0.5" />
                <input
                  id={`kit-${r.key}`}
                  defaultValue={v}
                  key={v}
                  maxLength={7}
                  spellCheck={false}
                  onBlur={(e) => { const x = e.target.value.trim(); if (isHex(x)) onChange(withPaletteColor(kit, r.key, x)); else e.target.value = v }}
                  className="min-h-[44px] w-full rounded-[var(--r-sm)] border-[1.5px] border-gray-300 px-3 font-mono text-[15px] font-semibold text-ink outline-none focus:border-doya-500"
                />
              </div>
              <p className="text-[12px] text-[var(--sub)]">{FROM_LABEL[prov.from]}。{prov.note}</p>
            </div>
          )
        })}
      </div>

      <ul className="grid gap-1.5" aria-label="色の点検">
        {checks.map((c) => (
          <li key={c.key} className={`flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-sm)] px-3 py-2 text-[13px] font-bold ${c.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}>
            <span>{c.label}</span>
            <span>{c.ok ? `対比 ${c.value}（${c.min} 以上。問題ありません）` : `対比 ${c.value}。${c.min} 以上にしてください`}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {!allOk && <p className="text-[13px] font-bold text-rose-800">足りない点を直すと、確定できます。</p>}
        <button type="button" disabled={!allOk} onClick={onConfirm} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-doya-500 px-5 text-sm font-black text-white shadow-lg shadow-doya-500/30 disabled:cursor-not-allowed disabled:opacity-40">
          <Check className="h-4 w-4" aria-hidden /> 「{ART_SPEC[d.type].label}」の方向で確定する
        </button>
      </div>
    </section>
  )
}
