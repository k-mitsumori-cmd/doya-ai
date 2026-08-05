'use client'

import { useEffect, useState } from 'react'

type SlideImageProps = {
  src: string
  alt: string
  className?: string
}

export default function SlideImage({ src, alt, className = '' }: SlideImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')

  useEffect(() => {
    setStatus('loading')
  }, [src])

  return (
    <>
      {status !== 'loaded' && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-900 text-white/90"
          role="status"
          aria-live="polite"
        >
          {status === 'loading' ? (
            <>
              <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
              <p className="text-xs font-bold">画像を読み込み中…</p>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-3xl text-rose-300">broken_image</span>
              <p className="text-xs font-bold">画像を読み込めませんでした</p>
            </>
          )}
        </div>
      )}
      {/* Generated slide URLs can be local or remote and need direct load/error events. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        className={`${className} transition-opacity duration-300 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  )
}
