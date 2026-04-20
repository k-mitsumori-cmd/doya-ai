import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function OpenGraphImage() {
  const title = '「タイトル入れるだけ」\nSEO記事ライティング、\n全部AIにまるなげ。'
  const sub =
    'ドヤライティングAIは、SEOに強い記事をテンプレ化。\nキーワードと記事タイプを選ぶだけで、最適な記事を自動生成。'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #0EA34A 0%, #17B45A 45%, #0B8B3F 100%)',
          padding: 64,
          boxSizing: 'border-box',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif',
        }}
      >
        {/* 左：コピー */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', color: '#fff' }}>
          <div style={{ fontSize: 68, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.02em', whiteSpace: 'pre-wrap' }}>
            {title}
          </div>
          <div style={{ marginTop: 22, fontSize: 22, fontWeight: 700, lineHeight: 1.55, opacity: 0.92, whiteSpace: 'pre-wrap' }}>
            {sub}
          </div>
          <div
            style={{
              marginTop: 26,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 18px',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.22)',
              fontSize: 18,
              fontWeight: 900,
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: '#FFFFFF',
                boxShadow: '0 0 0 4px rgba(255,255,255,0.18)',
              }}
            />
            比較記事やナレッジ記事などを自動制作
          </div>
        </div>

        {/* 右：スクリーンショット枠（添付画像の代替表現。差し替え可能） */}
        <div style={{ width: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: 520,
              height: 340,
              borderRadius: 18,
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.18)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 40%, rgba(0,0,0,0.08) 100%)',
              }}
            />
            <div style={{ position: 'absolute', top: 14, left: 16, display: 'flex', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: '#FF5F56' }} />
              <div style={{ width: 10, height: 10, borderRadius: 999, background: '#FFBD2E' }} />
              <div style={{ width: 10, height: 10, borderRadius: 999, background: '#27C93F' }} />
            </div>
            <div
              style={{
                position: 'absolute',
                left: 28,
                right: 28,
                top: 60,
                bottom: 28,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.92)',
                display: 'flex',
                flexDirection: 'column',
                padding: 18,
                boxSizing: 'border-box',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 34, height: 34, borderRadius: 12, background: 'linear-gradient(135deg,#2563EB,#4F46E5)' }} />
                <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>SEO記事を作成する</div>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: '#E2E8F0' }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, height: 54, borderRadius: 14, background: '#F1F5F9' }} />
                <div style={{ width: 140, height: 54, borderRadius: 14, background: '#E2E8F0' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, height: 54, borderRadius: 14, background: '#F1F5F9' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
                <div style={{ flex: 1, height: 44, borderRadius: 14, background: 'linear-gradient(135deg,#0EA34A,#17B45A)' }} />
                <div style={{ width: 140, height: 44, borderRadius: 14, background: '#0f172a' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size
  )
}


