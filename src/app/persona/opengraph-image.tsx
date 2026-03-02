import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default async function OpenGraphImage() {
  const title = 'URLを入れるだけで\nターゲットペルソナを\nAIが自動生成。'
  const sub =
    'ドヤペルソナAIは、URLからペルソナ履歴書・日記・スケジュール\n深掘りインタビュー・導入ストーリーまで一括生成。'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 45%, #6d28d9 100%)',
          padding: 64,
          boxSizing: 'border-box',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif',
        }}
      >
        {/* 左：コピー */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', color: '#fff' }}>
          <div style={{ fontSize: 62, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.02em', whiteSpace: 'pre-wrap' }}>
            {title}
          </div>
          <div style={{ marginTop: 22, fontSize: 20, fontWeight: 700, lineHeight: 1.6, opacity: 0.92, whiteSpace: 'pre-wrap' }}>
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
              fontSize: 17,
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
            履歴書 × 日記 × インタビュー × 導入ストーリー
          </div>
        </div>

        {/* 右：ペルソナ履歴書風プレビュー */}
        <div style={{ width: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: 400,
              height: 480,
              borderRadius: 18,
              background: '#ffffff',
              boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              padding: 24,
              boxSizing: 'border-box',
            }}
          >
            {/* ヘッダー */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#1f2937', letterSpacing: '0.1em' }}>ペルソナ履歴書</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>2025年 現在</div>
            </div>

            {/* 名前 + 写真 */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ height: 8, width: 60, borderRadius: 4, background: '#e5e7eb' }} />
                <div style={{ height: 20, width: 160, borderRadius: 4, background: '#1f2937' }} />
                <div style={{ height: 10, width: 100, borderRadius: 4, background: '#e5e7eb' }} />
              </div>
              <div style={{ width: 72, height: 90, borderRadius: 6, background: 'linear-gradient(135deg, #ddd6fe, #c4b5fd)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 32, opacity: 0.5 }}>👤</div>
              </div>
            </div>

            {/* テーブル風行 */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <div style={{ width: 70, height: 24, borderRadius: 4, background: '#f3f4f6' }} />
              <div style={{ flex: 1, height: 24, borderRadius: 4, background: '#f9fafb', border: '1px solid #e5e7eb' }} />
              <div style={{ width: 70, height: 24, borderRadius: 4, background: '#f3f4f6' }} />
              <div style={{ flex: 1, height: 24, borderRadius: 4, background: '#f9fafb', border: '1px solid #e5e7eb' }} />
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
              <div style={{ width: 70, height: 24, borderRadius: 4, background: '#f3f4f6' }} />
              <div style={{ flex: 1, height: 24, borderRadius: 4, background: '#f9fafb', border: '1px solid #e5e7eb' }} />
            </div>

            {/* 課題・目標 2カラム */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ height: 20, borderRadius: 4, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}>課題・悩み</div>
                </div>
                <div style={{ height: 10, borderRadius: 3, background: '#fee2e2' }} />
                <div style={{ height: 10, borderRadius: 3, background: '#fee2e2', width: '80%' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ height: 20, borderRadius: 4, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a' }}>目標・願望</div>
                </div>
                <div style={{ height: 10, borderRadius: 3, background: '#dcfce7' }} />
                <div style={{ height: 10, borderRadius: 3, background: '#dcfce7', width: '80%' }} />
              </div>
            </div>

            {/* セクションバッジ */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
              {['スケジュール', '日記', 'ペインポイント', 'インタビュー', '導入ストーリー'].map((label) => (
                <div
                  key={label}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #ede9fe, #f5f3ff)',
                    border: '1px solid #ddd6fe',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#7c3aed',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
