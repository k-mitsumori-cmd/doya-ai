import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getServiceById } from '@/lib/services'

export const runtime = 'edge'

const size = { width: 1200, height: 630 }

// ブランド青のOG（2026リブランド）。サービス別データは services.ts から取得。
const BRAND_GRADIENT = 'linear-gradient(135deg, #0047b3 0%, #0066ff 55%, #3d80ff 100%)'

// 背景素材 public/<id>/og-bg.jpg を持つサービス。
// ⚠️ 実体が無いIDを足すと OG が背景ごと落ちるので、ファイルを置いてから追加すること。
// ⚠️⚠️ 拡張子は .jpg。next/og の Satori は **WebP を読めない**（"Unsupported image type:
//      image/webp" を警告に出すだけで例外を投げず、背景が黙って消える）。
//      2026-08-20 まで og-bg.webp を指しており、17サービス全ての背景が
//      一度も描画されていなかった。PNG か JPEG 以外を指さないこと。
const OG_BG_SERVICES = new Set([
  'mensetsu', 'quote', 'aishodan', 'adimage',
  'banner', 'hr', 'kintai', 'sfa', 'shodan', 'aio',
  'seo', 'interview', 'persona', 'doyalist', 'doyaslide', 'cunning', 'promane',
])

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const raw = params.slug?.[0]?.replace(/\.(png|jpg|jpeg)$/i, '') || 'portal'
  const svc = getServiceById(raw)

  const title = svc?.name || 'ドヤマーケAI'
  const subtitle = svc?.description || 'AIで、ビジネスの“ドヤれる”をつくる。'
  // 背景素材ありは右カラムが狭く、4つだとフッターに被るので2つに絞る
  const featureCount = svc && OG_BG_SERVICES.has(svc.id) ? 2 : 4
  const features = (svc?.features || ['記事生成', 'バナー作成', '営業支援', '資料作成']).slice(0, featureCount)

  // サービス別の背景素材があれば敷く（無ければ従来のブランドグラデのみ）
  const bgUrl =
    svc && OG_BG_SERVICES.has(svc.id)
      ? new URL(`/${svc.id}/og-bg.jpg`, request.nextUrl.origin).toString()
      : null

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: BRAND_GRADIENT, position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        {/* サービス別の製品画は左カラムに置く（全面に敷くと白文字が読めない） */}
        {bgUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgUrl}
            alt=""
            width={520}
            height={630}
            // ⚠️ Satori は objectPosition を無視して中央クロップする。
            //    そのため素材側を 520x630 に切り出し済みで、ここでは等倍で置くだけにする。
            style={{ position: 'absolute', left: 0, top: 0, width: '520px', height: '630px' }}
          />
        )}
        {/* テキスト側のパネル。左端はグラデで製品画へ溶かす */}
        {bgUrl && (
          <div style={{
            position: 'absolute', left: 0, top: 0, width: '760px', height: '630px',
            // 製品モックは素材の x=45..452 付近にあるので、完全に覆うのは 62%（≒471px）以降にする
            background: 'linear-gradient(90deg, rgba(0,58,150,0) 0%, rgba(0,58,150,0.18) 48%, rgba(0,71,179,0.92) 62%, #0057db 100%)',
          }} />
        )}
        {bgUrl && (
          <div style={{
            position: 'absolute', left: '760px', top: 0, width: '440px', height: '630px',
            background: 'linear-gradient(135deg, #0057db 0%, #0066ff 60%, #3d80ff 100%)',
          }} />
        )}
        {/* ドットパターン */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.12,
          backgroundImage: 'radial-gradient(circle at 25% 25%, white 2%, transparent 2%), radial-gradient(circle at 75% 75%, white 2%, transparent 2%)',
          backgroundSize: '60px 60px',
        }} />

        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: bgUrl ? 'flex-start' : 'center',
          textAlign: bgUrl ? 'left' : 'center',
          padding: bgUrl ? '60px 60px 60px 0' : '60px',
          marginLeft: bgUrl ? '470px' : '0',
          width: bgUrl ? '730px' : 'auto',
        }}>
          {/* ブランドタグ */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px',
            padding: '10px 22px', borderRadius: '999px', background: 'rgba(255,255,255,0.16)',
            color: 'white', fontSize: '26px', fontWeight: 700,
          }}>
            ドヤマーケAI
          </div>

          <div style={{ fontSize: bgUrl ? '62px' : '76px', fontWeight: 800, color: 'white', marginBottom: '18px', letterSpacing: '-0.02em', textShadow: '0 4px 24px rgba(0,0,0,0.35)' }}>
            {title}
          </div>

          <div style={{ fontSize: bgUrl ? '26px' : '30px', color: 'rgba(255,255,255,0.94)', marginBottom: bgUrl ? '30px' : '40px', maxWidth: bgUrl ? '680px' : '900px', lineHeight: 1.45 }}>
            {subtitle.length > 60 ? subtitle.slice(0, 58) + '…' : subtitle}
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: bgUrl ? 'flex-start' : 'center', maxWidth: bgUrl ? '680px' : '100%' }}>
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
