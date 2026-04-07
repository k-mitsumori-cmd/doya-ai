import type { Metadata } from 'next'
import { MitsuboshiHeader } from '@/components/mitsuboshi/layout/MitsuboshiHeader'
import { MitsuboshiFooter } from '@/components/mitsuboshi/layout/MitsuboshiFooter'
import { NagusameRoom } from '@/components/mitsuboshi/nagusame/NagusameRoom'
import { NAGUSAME_SEGMENTS } from '@/lib/mitsuboshi/nagusame/segments'

export const metadata: Metadata = {
  title: 'ナグサメ',
  description:
    '嫌だったこと、つらかったことを書き込むと、大勢の星々からそっと慰めが届きます。三ツ星アプリ Vol.01。',
}

export default function NagusameDefaultPage() {
  const segment = NAGUSAME_SEGMENTS.default
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
