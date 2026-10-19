'use client'
// プロマネの各画面の上の見出し（キャラクター・見出し・一言）。
// 新しい見た目では、見出しを h2 にし、キャラクターと絵文字の一言をやめて、短い説明だけにする（UI 品質 S-57・絵文字のアイコン禁止）。
// 偽のときは今までと同じ形（キャラクター＋h1＋一言）をそのまま出す。
import Image from 'next/image'
import type { ReactNode } from 'react'
import { useUiNext } from '@/components/shell/ui-next-context'

export default function PromanePageIntro({ image, imageSize = 80, title, titleClassName, legacyLead, legacyLeadClassName, lead, className, legacyTextClassName, children }: {
  /** 今までの見た目のキャラクター（/character/*.png） */
  image: string
  imageSize?: number
  title: ReactNode
  titleClassName: string
  /** 今までの見た目の一言（絵文字を含むことがある） */
  legacyLead: ReactNode
  legacyLeadClassName: string
  /** 新しい見た目の説明（絵文字なし） */
  lead: ReactNode
  /** 今までの見た目の外側の class */
  className: string
  legacyTextClassName?: string
  /** 右に置く操作（両方の見た目で出す） */
  children?: ReactNode
}) {
  const uiNext = useUiNext()
  if (uiNext) {
    return (
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{lead}</p>
        </div>
        {children}
      </div>
    )
  }
  return (
    <div className={className}>
      <Image src={image} alt="" width={imageSize} height={imageSize} className="animate-bounce-in drop-shadow-xl" unoptimized />
      <div className={legacyTextClassName}>
        <h1 className={titleClassName}>{title}</h1>
        <p className={legacyLeadClassName}>{legacyLead}</p>
      </div>
      {children}
    </div>
  )
}
