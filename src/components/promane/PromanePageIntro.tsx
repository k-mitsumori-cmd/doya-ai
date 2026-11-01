'use client'
import type { ReactNode } from 'react'

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
