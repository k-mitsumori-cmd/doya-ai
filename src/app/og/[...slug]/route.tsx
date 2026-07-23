import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getServiceById } from '@/lib/services'

export const runtime = 'edge'

const size = { width: 1200, height: 630 }

// ブランド青のOG（2026リブランド）。サービス別データは services.ts から取得。
const BRAND_GRADIENT = 'linear-gradient(135deg, #0047b3 0%, #0066ff 55%, #3d80ff 100%)'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const raw = params.slug?.[0]?.replace(/\.(png|jpg|jpeg)$/i, '') || 'portal'
  const svc = getServiceById(raw)

  const title = svc?.name || 'ドヤマーケAI'
  const subtitle = svc?.description || 'AIで、ビジネスの“ドヤれる”をつくる。'
  const features = (svc?.features || ['記事生成', 'バナー作成', '営業支援', '資料作成']).slice(0, 4)

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: BRAND_GRADIENT, position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        {/* ドットパターン */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.12,
          backgroundImage: 'radial-gradient(circle at 25% 25%, white 2%, transparent 2%), radial-gradient(circle at 75% 75%, white 2%, transparent 2%)',
          backgroundSize: '60px 60px',
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px', textAlign: 'center' }}>
          {/* ブランドタグ */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px',
            padding: '10px 22px', borderRadius: '999px', background: 'rgba(255,255,255,0.16)',
            color: 'white', fontSize: '26px', fontWeight: 700,
          }}>
            ドヤマーケAI
          </div>

          <div style={{ fontSize: '76px', fontWeight: 800, color: 'white', marginBottom: '18px', letterSpacing: '-0.02em', textShadow: '0 4px 24px rgba(0,0,0,0.25)' }}>
            {title}
          </div>

          <div style={{ fontSize: '30px', color: 'rgba(255,255,255,0.92)', marginBottom: '40px', maxWidth: '900px', lineHeight: 1.4 }}>
            {subtitle.length > 60 ? subtitle.slice(0, 58) + '…' : subtitle}
          </div>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {features.map((f, i) => (
              <div key={i} style={{
                padding: '12px 24px', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: '50px',
                color: 'white', fontSize: '24px', fontWeight: 600,
              }}>
                {f.length > 16 ? f.slice(0, 15) + '…' : f}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '40px', fontSize: '24px', color: 'rgba(255,255,255,0.8)' }}>
          doya-ai.surisuta.jp
        </div>
      </div>
    ),
    { ...size }
  )
}
