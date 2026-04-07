'use client'

/**
 * 重篤ワード検出時の相談窓口モーダル
 *
 * 強制ブロックしない（「このまま続ける」を残す）。
 * ただしセッション内で1度は必ず表示する前提。
 */

import { SAFETY_RESOURCES } from '@/lib/mitsuboshi/_shared/safety'

interface Props {
  open: boolean
  onClose: () => void
}

export function SafetyModal({ open, onClose }: Props) {
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-mitsuboshi-midnight/85 backdrop-blur-sm px-5"
    >
      <div className="w-full max-w-sm rounded-3xl border border-mitsuboshi-champagne/40 bg-mitsuboshi-indigo p-6 text-mitsuboshi-moon shadow-glow-champagne-lg">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex gap-1 text-mitsuboshi-champagne">
            <span>☆</span>
            <span>☆</span>
            <span>☆</span>
          </div>
          <h2 className="font-mitsuboshi text-xl">{SAFETY_RESOURCES.intro.split('。')[0]}。</h2>
          <p className="text-[13px] leading-relaxed text-mitsuboshi-mist">
            {SAFETY_RESOURCES.intro.split('。').slice(1).join('。').trim() ||
              'もし今、本当につらいなら、専門の人に話せる場所があります。'}
          </p>
        </div>
        <ul className="mt-5 flex flex-col gap-3">
          {SAFETY_RESOURCES.lines.map((line) => (
            <li
              key={line.name}
              className="rounded-2xl border border-mitsuboshi-twilight/80 bg-mitsuboshi-midnight/60 px-4 py-3"
            >
              <p className="text-[13px] text-mitsuboshi-moon">{line.name}</p>
              <a
                href={`tel:${line.phone.replace(/-/g, '')}`}
                className="text-[15px] font-mitsuboshi text-mitsuboshi-champagne"
              >
                {line.phone}
              </a>
              <p className="text-[11px] text-mitsuboshi-fog">{line.hours}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-[11px] text-mitsuboshi-fog">
          {SAFETY_RESOURCES.disclaimer}
        </p>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-full border border-mitsuboshi-champagne/70 bg-mitsuboshi-champagne/10 py-3 text-[14px] text-mitsuboshi-champagne transition hover:bg-mitsuboshi-champagne/20"
        >
          このまま閉じる
        </button>
      </div>
    </div>
  )
}
