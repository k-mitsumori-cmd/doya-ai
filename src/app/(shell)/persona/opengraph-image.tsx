import { ImageResponse } from 'next/og'
import { SITE_CONFIG } from '@/lib/seo'

export const runtime = 'edge'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

// Codex内蔵の画像生成で作った静的OGP（public/ogp/persona.jpg）をそのまま返す。
// このファイル規約はメタデータの openGraph.images より優先されるため、ここで差し替える。
export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`${SITE_CONFIG.url}/ogp/persona.jpg`} alt="" width={1200} height={630} />
    ),
    { ...size }
  )
}
