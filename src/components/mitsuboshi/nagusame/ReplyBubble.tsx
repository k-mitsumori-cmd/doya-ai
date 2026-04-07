'use client'

/**
 * 1通分の慰めコメント表示
 *
 * 左にキャラアバター、右に名前と本文。
 * 出現時にゴールドのグローをフワッと灯す。
 */

interface Props {
  avatar: string
  personaName: string
  content: string
}

export function ReplyBubble({ avatar, personaName, content }: Props) {
  return (
    <div className="flex items-start gap-3 animate-fade-in-up">
      <div
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-mitsuboshi-champagne/40 bg-mitsuboshi-indigo text-xl shadow-glow-champagne"
      >
        {avatar}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[12px] tracking-wide text-mitsuboshi-champagne">
          {personaName}
          <span className="ml-1 text-mitsuboshi-fog">✦</span>
        </p>
        <p className="whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-mitsuboshi-twilight/80 bg-mitsuboshi-indigo/80 px-4 py-3 text-[15px] leading-[1.85] text-mitsuboshi-moon">
          {content}
        </p>
      </div>
    </div>
  )
}
