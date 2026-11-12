'use client'
// キービジュアルを先に1枚作り、本人が見て確定する段（BOOTH-CONCEPT-FLOW-2026-11-11.md 3 章の 4）。
// 背面壁の中央の画像が、残りの面・制作物・完成予想図の見本になる。確定するまで、残りは作れない。作り直しもできる。
import { Check, ImagePlus, RefreshCw } from 'lucide-react'
import { ShellCostBadge } from '@/components/shell/power'

export default function KeyVisualStep({ image, directionLabel, kitConfirmed, confirmed, disabledReason, quotaLabel, aspect, onMake, onConfirm }: {
  image?: string
  directionLabel: string
  kitConfirmed: boolean
  confirmed: boolean
  /** 作れない理由（画像の生成を止めているとき） */
  disabledReason?: string
  quotaLabel?: string | null
  /** 背面壁の中央の縦横比（幅 / 高さ） */
  aspect: number
  onMake: () => void
  onConfirm: () => void
}) {
  const state = confirmed ? 'confirmed' : image ? 'review' : 'empty'
  return (
    <section aria-labelledby="kv-title" data-kv-state={state} className="flex flex-col gap-4 rounded-[var(--r)] border border-gray-200 bg-white p-5 sm:flex-row">
      <div className="flex w-full flex-none items-center justify-center rounded-[var(--r-sm)] bg-[var(--track)] p-3 sm:w-56">
        <div className="overflow-hidden rounded-md bg-white shadow-[0_8px_24px_-10px_rgba(16,22,51,.4)]" style={{ aspectRatio: `${aspect}`, height: aspect > 1 ? 'auto' : 200, width: aspect > 1 ? '100%' : 'auto', maxWidth: '100%' }}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="キービジュアル（背面壁の中央）" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center border-2 border-dashed border-gray-300 p-3 text-center text-[12px] font-bold text-gray-500">まだ作っていません</div>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 id="kv-title" className="text-[18px] font-bold leading-snug text-ink">キービジュアルを、先に1枚作ります</h2>
        <p className="text-[14px] leading-relaxed text-[var(--sub)]">
          背面壁の中央の絵です（方向：{directionLabel}）。この絵を見本にして、残りの面・制作物・完成予想図を作ります。見て気に入らなければ、作り直せます。
        </p>
        {!kitConfirmed && <p role="alert" className="rounded-[var(--r-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-900">先に、上の方向を確定してください。</p>}
        {kitConfirmed && disabledReason && !image && <p role="alert" className="rounded-[var(--r-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-900">{disabledReason}</p>}
        {quotaLabel && <p className="text-[13px] text-[var(--sub)]">{quotaLabel}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {confirmed ? (
            <>
              <p className="inline-flex items-center gap-1.5 text-[14px] font-black text-emerald-700"><Check className="h-4 w-4" aria-hidden /> このキービジュアルで確定しています</p>
              <button type="button" onClick={onMake} disabled={!kitConfirmed || !!disabledReason} className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] border-2 border-doya-500 px-4 text-sm font-black text-doya-600 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40">
                <RefreshCw className="h-4 w-4" aria-hidden /> 作り直す
              </button>
            </>
          ) : image ? (
            <>
              <button type="button" onClick={onConfirm} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-doya-500 px-5 text-sm font-black text-white shadow-lg shadow-doya-500/30">
                <Check className="h-4 w-4" aria-hidden /> このキービジュアルで確定する
              </button>
              <button type="button" onClick={onMake} disabled={!kitConfirmed || !!disabledReason} className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-sm)] border-2 border-doya-500 px-4 text-sm font-black text-doya-600 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40">
                <RefreshCw className="h-4 w-4" aria-hidden /> 作り直す
                <ShellCostBadge action="tenjikai.image" />
              </button>
            </>
          ) : (
            <button type="button" onClick={onMake} disabled={!kitConfirmed || !!disabledReason} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-doya-500 px-5 text-sm font-black text-white shadow-lg shadow-doya-500/30 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40">
              <ImagePlus className="h-4 w-4" aria-hidden /> キービジュアルを作る（1枚）
              <ShellCostBadge action="tenjikai.image" />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
