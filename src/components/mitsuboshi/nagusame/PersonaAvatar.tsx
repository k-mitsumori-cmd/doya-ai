'use client'

/**
 * ペルソナのアバター表示
 *
 * imageUrl があればアニメ調キャラ画像を、なければ絵文字をフォールバックで表示。
 * 円形にクロップ、ゴールドの縁取り + グロー。
 */

import { useState } from 'react'

interface Props {
  imageUrl?: string
  fallbackEmoji: string
  alt: string
  /** 直径 (px) */
  size?: number
  className?: string
}

export function PersonaAvatar({
  imageUrl,
  fallbackEmoji,
  alt,
  size = 40,
  className = '',
}: Props) {
  const [errored, setErrored] = useState(false)
  const showImage = imageUrl && !errored

  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-mitsuboshi-champagne/40 bg-mitsuboshi-indigo shadow-glow-champagne ${className}`}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span style={{ fontSize: Math.floor(size * 0.5) }}>{fallbackEmoji}</span>
      )}
    </div>
  )
}
