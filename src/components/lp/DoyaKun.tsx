// ============================================
// 公式マスコット「ドヤくん」— 共通コンポーネント（集約版）
// 旧: shodan/ui・aio/ui・doyaslide/DoyaChar・promane/character に重複していたものを統合。
// 素材は既存の public/character/*.png を流用。影はブランド青に。
// ============================================
import React from 'react'

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

/** ドヤくん表示（ふわふわ浮遊・ブランド影） */
export function DoyaKun({
  mood = 'hello',
  size = 96,
  float = true,
  className = '',
  delay = 0,
  priority = false,
}: {
  mood?: Mood
  size?: number
  float?: boolean
  className?: string
  delay?: number
  priority?: boolean
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={CHAR[mood]}
      alt="ドヤくん"
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      className={`${float ? 'animate-float' : ''} ${className} select-none pointer-events-none drop-shadow-[0_10px_24px_rgba(0,102,255,0.20)]`}
      style={{ width: size, height: size, objectFit: 'contain', animationDelay: `${delay}s` }}
    />
  )
}
