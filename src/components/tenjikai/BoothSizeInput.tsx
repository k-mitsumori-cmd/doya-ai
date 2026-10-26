'use client'

// 小間の大きさ（横 ○m × 奥行 ○m）を入れる欄。よく使う大きさはボタンで入れられる。
// 決まり（1〜30m・0.5m 刻み）は engine.ts の checkBoothMeter。サーバー（/api/tenjikai/generate）も同じ決まりで確かめる。
// 正しい値のときだけ onChange を呼ぶ。正しくないときは、欄の下に直し方を出し、onValidChange(false) を伝える。
import { useEffect, useId, useState } from 'react'
import { clsx } from 'clsx'
import { BOOTH_SIZE_LIMIT, BOOTH_SIZE_PRESETS, checkBoothMeter } from '@/lib/tenjikai/engine'

interface Props {
  widthM: number
  depthM: number
  onChange: (widthM: number, depthM: number) => void
  /** 入力が正しいかどうか（送信ボタンを止めるのに使う） */
  onValidChange?: (ok: boolean) => void
  /** 見出しの文字（既定は「小間の大きさ」） */
  label?: string
}

export default function BoothSizeInput({ widthM, depthM, onChange, onValidChange, label = '小間の大きさ' }: Props) {
  const id = useId()
  const [w, setW] = useState(String(widthM))
  const [d, setD] = useState(String(depthM))

  // 外から値が変わったとき（プリセット・保存の読み込み）は欄に合わせる
  useEffect(() => setW(String(widthM)), [widthM])
  useEffect(() => setD(String(depthM)), [depthM])

  const cw = checkBoothMeter('横', w)
  const cd = checkBoothMeter('奥行', d)
  const ok = cw.ok && cd.ok

  useEffect(() => {
    onValidChange?.(ok)
  }, [ok, onValidChange])

  const update = (nextW: string, nextD: string) => {
    setW(nextW)
    setD(nextD)
    const a = checkBoothMeter('横', nextW)
    const b = checkBoothMeter('奥行', nextD)
    if (a.ok && b.ok) onChange(a.value, b.value)
  }

  const errors = [cw, cd].filter((c): c is { ok: false; message: string } => !c.ok).map((c) => c.message)
  const inputCls = (bad: boolean) =>
    clsx('w-20 rounded-xl border-2 px-3 py-2 text-right font-mono text-sm font-bold outline-none', bad ? 'border-rose-400 focus:border-rose-500' : 'border-gray-200 focus:border-doya-500')

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-black text-gray-500">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-w`} className="text-sm font-bold text-ink">横</label>
        <input
          id={`${id}-w`}
          data-testid="booth-width"
          type="number"
          inputMode="decimal"
          min={BOOTH_SIZE_LIMIT.minM}
          max={BOOTH_SIZE_LIMIT.maxM}
          step={BOOTH_SIZE_LIMIT.stepM}
          value={w}
          aria-invalid={!cw.ok}
          aria-describedby={`${id}-help`}
          onChange={(e) => update(e.target.value, d)}
          className={inputCls(!cw.ok)}
        />
        <span className="text-sm font-bold text-ink">m</span>
        <span className="px-1 text-sm text-gray-400" aria-hidden>×</span>
        <label htmlFor={`${id}-d`} className="text-sm font-bold text-ink">奥行</label>
        <input
          id={`${id}-d`}
          data-testid="booth-depth"
          type="number"
          inputMode="decimal"
          min={BOOTH_SIZE_LIMIT.minM}
          max={BOOTH_SIZE_LIMIT.maxM}
          step={BOOTH_SIZE_LIMIT.stepM}
          value={d}
          aria-invalid={!cd.ok}
          aria-describedby={`${id}-help`}
          onChange={(e) => update(w, e.target.value)}
          className={inputCls(!cd.ok)}
        />
        <span className="text-sm font-bold text-ink">m</span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="よく使う大きさ">
        {BOOTH_SIZE_PRESETS.map((p) => {
          const on = widthM === p.widthM && depthM === p.depthM && ok
          return (
            <button
              type="button"
              key={p.label}
              aria-pressed={on}
              onClick={() => update(String(p.widthM), String(p.depthM))}
              className={clsx('rounded-full border-2 px-3 py-1 text-[12px] font-bold transition-colors', on ? 'border-doya-500 bg-doya-500 text-white' : 'border-gray-200 text-ink hover:border-doya-200')}
            >
              {p.label}（{p.widthM}×{p.depthM}m）
            </button>
          )
        })}
      </div>
      <p id={`${id}-help`} className={clsx('text-[12px]', errors.length ? 'font-bold text-rose-600' : 'text-gray-500')} role={errors.length ? 'alert' : undefined}>
        {errors.length ? errors.join(' ') : `${BOOTH_SIZE_LIMIT.minM}〜${BOOTH_SIZE_LIMIT.maxM}mで、0.5m刻みで入れられます。`}
      </p>
    </fieldset>
  )
}
