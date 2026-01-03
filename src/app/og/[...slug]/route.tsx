import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

// OGP画像サイズ
const size = {
  width: 1200,
  height: 630,
}

// サービスごとのデザイン設定
const SERVICE_DESIGNS = {
  portal: {
    title: 'ドヤAIポータル',
    subtitle: 'ビジネスを加速するAIツール群',
    icon: '✨',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #EC4899 100%)',
    features: ['文章生成', 'バナー作成', 'LP制作', '動画台本'],
  },
  kantan: {
    title: 'カンタンドヤAI',
    subtitle: 'AIで文章作成がカンタンになる',
    icon: '📝',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
    features: ['ビジネスメール', 'ブログ記事', 'SNS投稿', 'キャッチコピー'],
  },
  banner: {
    title: 'ドヤバナーAI',
    subtitle: 'プロ品質バナーを自動生成',
    icon: '🎨',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
    features: ['A/B/C 3案生成', '10種類テンプレート', '高品質出力', 'ブランド設定'],
  },
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const slug = params.slug?.[0] || 'portal'
  const serviceKey = slug.replace('.png', '') as keyof typeof SERVICE_DESIGNS
  const design = SERVICE_DESIGNS[serviceKey] || SERVICE_DESIGNS.portal

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: design.gradient,
          position: 'relative',
        }}
      >
        {/* 背景パターン */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1,
            backgroundImage: 'radial-gradient(circle at 25% 25%, white 2%, transparent 2%), radial-gradient(circle at 75% 75%, white 2%, transparent 2%)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* コンテンツ */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px',
            textAlign: 'center',
          }}
        >
          {/* アイコン */}
          <div
            style={{
              fontSize: '80px',
              marginBottom: '20px',
            }}
          >
            {design.icon}
          </div>

          {/* タイトル */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '16px',
              textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}
          >
            {design.title}
          </div>

          {/* サブタイトル */}
          <div
            style={{
              fontSize: '32px',
              color: 'rgba(255, 255, 255, 0.9)',
              marginBottom: '40px',
            }}
          >
            {design.subtitle}
          </div>

          {/* 機能タグ */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {design.features.map((feature, index) => (
              <div
                key={index}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '50px',
                  color: 'white',
                  fontSize: '24px',
                  fontWeight: '500',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* フッター */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}
          >
            ✨
          </div>
          <div
            style={{
              fontSize: '24px',
              color: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            doya-ai.vercel.app
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}

