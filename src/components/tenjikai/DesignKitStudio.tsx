'use client'
// ============================================
// ブースのデザインの決まりを決める画面（仕様 4.2）
// ============================================
// 最初に1つ決める。決めたあとで作る面・制作物は、すべて同じ決まりで作る。確定するまで、画像を作るボタンは押せない。
// - 3つの案（面積の比率・帯の高さ・円の大きさが違う）の見本を、コードで描いて並べる（AI を呼ばないので無料）
// - 主色・暗色・差し色は、色を直せる。出どころ（読み取り・自動で調整・あなたが直した）を出す
// - 点検: 白い見出しが読めるか、暗い文字が読めるか、差し色と主色の見分けがつくか。足りないと確定できない
import { Check, Palette, Pencil } from 'lucide-react'
import { KIT_VARIANTS, checkKit, isHex, withPaletteColor, withVariant, type BoothDesignKit, type KitVariantKey } from '@/lib/tenjikai/design-kit'

const ROLES = [
  { key: 'primary', label: '主色', note: '見出しの帯と大きな面' },
  { key: 'dark', label: '暗色', note: '濃い面と、紙の上の文字' },
  { key: 'accent', label: '差し色', note: '小さな面だけ' },
] as const

const FROM_LABEL = { analysis: '読み取った色', derived: '自動で調整した色', user: 'あなたが直した色', default: '既定の色' } as const

/** 3つの案の見本（ヒーローの型。帯と円の形を、決まりのとおりに描く） */
function Board({ kit }: { kit: BoothDesignKit }) {
  const W = 120, H = 160
  const p = kit.palette, m = kit.motif, z = kit.zones
  const head = H * z.headBandRatio
  const r = (Math.min(W, H) * m.circleDiameterRatio) / 2
  const bandH = H * m.bandHeightRatio
  const slope = Math.tan((m.bandAngleDeg * Math.PI) / 180) * W
  const cy = H * 0.62
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="デザインの決まりの見本">
      <rect width={W} height={H} fill={p.paper} />
      <rect y={H * (1 - z.footBandRatio)} width={W} height={H * z.footBandRatio} fill={p.mist} />
      <polygon points={`0,${cy + slope / 2} ${W},${cy - slope / 2} ${W},${cy - slope / 2 + bandH} 0,${cy + slope / 2 + bandH}`} fill={p.accent} />
      <circle cx={W - r * 0.9} cy={cy + r * 0.5} r={r} fill={p.dark} />
      <rect width={W} height={head} fill={p.primary} />
      <rect x={W * 0.1} y={head * 0.3} width={W * 0.62} height={head * 0.16} rx={2} fill={p.paper} />
      <rect x={W * 0.1} y={head * 0.56} width={W * 0.4} height={head * 0.12} rx={2} fill={p.paper} opacity={0.7} />
    </svg>
  )
}

export default function DesignKitStudio({ kit, confirmed, onChange, onConfirm, onReopen, madeCount = 0 }: {
  kit: BoothDesignKit
  confirmed: boolean
  onChange: (kit: BoothDesignKit) => void
  onConfirm: () => void
  onReopen: () => void
  /** 作り済みの面の数（決まりを直すときの注意に使う） */
  madeCount?: number
}) {
  const checks = checkKit(kit)
  const allOk = checks.every((c) => c.ok)

  if (confirmed) {
    return (
      <section aria-label="ブースのデザインの決まり" data-kit-state="confirmed" className="flex flex-wrap items-center gap-4 rounded-[var(--r)] border border-gray-200 bg-white px-5 py-4">
        <Palette className="h-5 w-5 flex-none text-doya-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-black text-ink">ブースのデザインの決まりは、確定しています（{KIT_VARIANTS[kit.variant].label}）</p>
          <p className="mt-0.5 text-[13px] text-[var(--sub)]">これから作る面・制作物は、すべてこの決まりで作ります。</p>
        </div>
        <div className="flex items-center gap-1.5" aria-label="決まりの色">
          {(['primary', 'dark', 'accent'] as const).map((k) => (
            <span key={k} className="h-7 w-7 rounded-full ring-2 ring-white" style={{ background: kit.palette[k], boxShadow: '0 0 0 1px rgba(16,22,51,.15)' }} title={`${k} ${kit.palette[k]}`} />
          ))}
        </div>
        <button type="button" onClick={onReopen} className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] border-2 border-doya-500 px-4 text-sm font-black text-doya-600">
          <Pencil className="h-4 w-4" aria-hidden /> 決まりを直す
        </button>
      </section>
    )
  }

  return (
    <section aria-labelledby="kit-title" data-kit-state="editing" className="flex flex-col gap-5 rounded-[var(--r)] border-2 border-doya-200 bg-white p-5 md:p-6">
      <div>
        <h2 id="kit-title" className="text-[18px] font-bold leading-snug text-ink">ブースのデザインの決まりを、先に決めます</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-[var(--sub)]">ここで決めた色・形・文字の置き方で、面も制作物も、すべて同じに作ります。確定するまで、画像は作れません。この画面は、費用がかかりません。</p>
        {madeCount > 0 && <p className="mt-2 rounded-[var(--r-sm)] bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-900">すでに作った {madeCount} 面の画像は、前の決まりで作られています。決まりを直したあとで作り直すと、新しい決まりでそろいます。</p>}
      </div>

      <div role="radiogroup" aria-label="決まりの案" className="grid grid-cols-3 gap-3">
        {(Object.keys(KIT_VARIANTS) as KitVariantKey[]).map((v) => {
          const active = kit.variant === v
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(withVariant(kit, v))}
              className={`flex flex-col gap-2 rounded-[var(--r-sm)] border-2 p-2 text-left transition-colors ${active ? 'border-doya-500 bg-doya-50' : 'border-gray-200 bg-white hover:border-doya-200'}`}
            >
              <span className="block overflow-hidden rounded-md border border-gray-200"><Board kit={withVariant(kit, v)} /></span>
              <span className="flex items-start gap-1 text-[12px] font-black leading-snug text-ink [text-wrap:balance] sm:text-[13px]">{active && <Check className="mt-0.5 hidden h-3.5 w-3.5 flex-none text-doya-600 sm:block" aria-hidden />}{KIT_VARIANTS[v].label}</span>
              <span className="hidden text-[12px] leading-snug text-[var(--sub)] sm:block">{KIT_VARIANTS[v].note}</span>
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

      <ul className="grid gap-1.5" aria-label="決まりの点検">
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
          <Check className="h-4 w-4" aria-hidden /> この決まりで確定する
        </button>
      </div>
    </section>
  )
}
