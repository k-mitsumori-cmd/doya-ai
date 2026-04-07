'use client'

/**
 * 星座ゲージ: 届いた慰めの数だけ ☆ が灯る
 *
 * 返信が届くたびに順番に ignite アニメが走り、全員分灯ると
 * 「満点」メッセージが表示される。
 */

interface Props {
  lit: number
  total: number
}

export function StarConstellation({ lit, total }: Props) {
  const safeTotal = Math.max(total, 1)
  const safeLit = Math.min(lit, safeTotal)
  const stars = Array.from({ length: safeTotal })

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-1.5">
        {stars.map((_, i) => {
          const isLit = i < safeLit
          return (
            <span
              key={i}
              aria-hidden
              className={
                isLit
                  ? 'text-mitsuboshi-champagne animate-star-ignite drop-shadow-[0_0_8px_rgba(232,199,102,0.6)]'
                  : 'text-mitsuboshi-fog/50'
              }
              style={{ animationDelay: isLit ? `${i * 40}ms` : undefined }}
            >
              ☆
            </span>
          )
        })}
      </div>
      <p className="text-[11px] text-mitsuboshi-mist">
        {safeLit < safeTotal
          ? `${safeLit} / ${safeTotal} の星が灯りました`
          : 'あなたの夜に、満天の星が灯りました'}
      </p>
    </div>
  )
}
