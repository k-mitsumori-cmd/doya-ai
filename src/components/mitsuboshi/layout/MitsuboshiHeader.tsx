/**
 * 三ツ星アプリ シリーズ共通ヘッダー
 *
 * `☆☆☆ 三ツ星アプリ Vol.XX / <プロダクト名>` の2段組。
 * ドヤAIのヘッダーやサイドバーは一切 import しない。
 */

import Link from 'next/link'

interface Props {
  volume: number
  productName: string
  productSubtitle?: string
}

export function MitsuboshiHeader({ volume, productName, productSubtitle }: Props) {
  const volumeLabel = `Vol.${String(volume).padStart(2, '0')}`
  return (
    <header
      className="relative z-10 border-b border-mitsuboshi-twilight/60 bg-mitsuboshi-midnight/80 backdrop-blur"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4">
        <Link href="/nagusame" className="flex flex-col leading-tight">
          <span className="flex items-center gap-1 text-[11px] tracking-[0.22em] text-mitsuboshi-mist">
            <span className="inline-flex gap-0.5 text-mitsuboshi-champagne animate-star-twinkle">
              <span>☆</span>
              <span>☆</span>
              <span>☆</span>
            </span>
            <span>三ツ星アプリ</span>
            <span className="text-mitsuboshi-fog">/</span>
            <span>{volumeLabel}</span>
          </span>
          <span className="font-mitsuboshi text-2xl font-semibold text-mitsuboshi-moon">
            {productName}
          </span>
          {productSubtitle ? (
            <span className="text-[11px] text-mitsuboshi-mist">{productSubtitle}</span>
          ) : null}
        </Link>
        <nav className="flex items-center gap-4 text-[12px] text-mitsuboshi-mist">
          <Link href="/nagusame" className="hover:text-mitsuboshi-champagne">
            ホーム
          </Link>
          <Link href="/nagusame/pricing" className="hover:text-mitsuboshi-champagne">
            PRO
          </Link>
        </nav>
      </div>
    </header>
  )
}
