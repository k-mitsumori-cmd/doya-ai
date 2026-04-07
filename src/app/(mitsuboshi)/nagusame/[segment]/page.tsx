import type { Metadata } from 'next'
import Link from 'next/link'
import { MitsuboshiHeader } from '@/components/mitsuboshi/layout/MitsuboshiHeader'
import { MitsuboshiFooter } from '@/components/mitsuboshi/layout/MitsuboshiFooter'
import { NagusameRoom } from '@/components/mitsuboshi/nagusame/NagusameRoom'
import { NAGUSAME_SEGMENTS, resolveSegment } from '@/lib/mitsuboshi/nagusame/segments'

interface Params {
  params: { segment: string }
}

export function generateStaticParams() {
  return Object.values(NAGUSAME_SEGMENTS).map((s) => ({ segment: s.slug }))
}

export function generateMetadata({ params }: Params): Metadata {
  const seg = resolveSegment(params.segment)
  return {
    title: seg.displayName,
    description: seg.subtitle,
  }
}

export default function NagusameSegmentPage({ params }: Params) {
  const segment = resolveSegment(params.segment)

  if (!segment.published) {
    return (
      <>
        <MitsuboshiHeader
          volume={1}
          productName={segment.displayName}
          productSubtitle="Coming Soon"
        />
        <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-5 px-5 py-16 text-center">
          <div className="flex gap-1 text-mitsuboshi-champagne">
            <span>☆</span>
            <span>☆</span>
            <span>☆</span>
          </div>
          <h1 className="font-mitsuboshi text-3xl text-mitsuboshi-moon">
            {segment.displayName}
          </h1>
          <p className="text-[13px] leading-relaxed text-mitsuboshi-mist">
            近日公開予定です。
            <br />
            それまでは、無印の『ナグサメ』がいつでもあなたの夜に寄り添います。
          </p>
          <Link
            href="/"
            className="rounded-full border border-mitsuboshi-champagne/70 bg-mitsuboshi-champagne/10 px-6 py-3 text-[14px] text-mitsuboshi-champagne hover:bg-mitsuboshi-champagne/20"
          >
            ナグサメ（無印）へ ☆
          </Link>
        </section>
        <MitsuboshiFooter />
      </>
    )
  }

  return (
    <>
      <MitsuboshiHeader
        volume={1}
        productName={segment.displayName}
        productSubtitle={segment.subtitle}
      />
      <NagusameRoom segment={segment} />
      <MitsuboshiFooter />
    </>
  )
}
