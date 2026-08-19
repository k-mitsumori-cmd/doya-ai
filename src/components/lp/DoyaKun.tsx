// ============================================
// 公式マスコット「ドヤくん」— 共通コンポーネント（集約版）
// 旧: shodan/ui・aio/ui・doyaslide/DoyaChar・promane/character に重複していたものを統合。
// 素材は既存の public/character/*.png を流用。影はブランド青に。
// ============================================
import React from 'react'
import Image from 'next/image'

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

// 軽量版（256 / 512px の WebP）。実体は public/character/<pose>-{256,512}.webp。
// ⚠️ 新しいポーズを足すときは 3サイズ（PNG原本 / 256 / 512）を揃えてから追加すること。
const CHAR_256 = Object.fromEntries(
  Object.entries(CHAR).map(([k, v]) => [k, v.replace(/\.png$/, '-256.webp')])
) as Record<Mood, string>
const CHAR_512 = Object.fromEntries(
  Object.entries(CHAR).map(([k, v]) => [k, v.replace(/\.png$/, '-512.webp')])
) as Record<Mood, string>

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
  // 816px/約800KB のPNGを次世代フォーマットの軽量版へ差し替えている。
  // 表示サイズが256pxを超えるときだけ512px版を使う。
  const src = size > 256 ? CHAR_512[mood] : CHAR_256[mood]

  return (
    <Image
      src={src}
      alt="ドヤくん"
      width={size}
      height={size}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      className={`${float ? 'animate-float' : ''} ${className} select-none pointer-events-none drop-shadow-[0_10px_24px_rgba(0,102,255,0.20)]`}
      style={{ width: size, height: size, objectFit: 'contain', animationDelay: `${delay}s` }}
    />
  )
}
