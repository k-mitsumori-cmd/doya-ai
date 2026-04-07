/**
 * 三ツ星アプリ シリーズ共通 OG 画像
 *
 * Next.js が `(mitsuboshi)/` 配下のすべてのページの OG 画像として
 * 自動配信する。Edge runtime + ImageResponse で高速生成。
 */

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = '三ツ星アプリ - 今日のあなたに、☆☆☆を。'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at 20% 20%, rgba(35,40,81,0.9) 0%, transparent 55%), radial-gradient(circle at 80% 90%, rgba(22,27,58,1) 0%, transparent 60%), linear-gradient(180deg, #0B0E24 0%, #161B3A 100%)',
          color: '#F5F3E8',
          fontFamily: 'serif',
          padding: '60px',
          position: 'relative',
        }}
      >
        {/* 星屑装飾 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(rgba(245,243,232,0.15) 1.5px, transparent 1.5px)',
            backgroundSize: '40px 40px',
            opacity: 0.5,
          }}
        />

        {/* 三ツ星 */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            fontSize: '72px',
            color: '#E8C766',
            marginBottom: '32px',
            filter: 'drop-shadow(0 0 24px rgba(232,199,102,0.7))',
            zIndex: 1,
          }}
        >
          <span>☆</span>
          <span>☆</span>
          <span>☆</span>
        </div>

        {/* シリーズ名 */}
        <div
          style={{
            fontSize: '36px',
            color: '#9098B8',
            letterSpacing: '0.18em',
            marginBottom: '20px',
            zIndex: 1,
          }}
        >
          三ツ星アプリ
        </div>

        {/* タグライン */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: 700,
            color: '#F5F3E8',
            textAlign: 'center',
            lineHeight: 1.4,
            zIndex: 1,
          }}
        >
          今日のあなたに、☆☆☆を。
        </div>

        {/* Vol.01 ナグサメ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginTop: '48px',
            padding: '16px 32px',
            border: '1px solid rgba(232,199,102,0.5)',
            borderRadius: '999px',
            background: 'rgba(232,199,102,0.08)',
            fontSize: '28px',
            color: '#E8C766',
            zIndex: 1,
          }}
        >
          <span style={{ color: '#9098B8' }}>Vol.01</span>
          <span>ナグサメ</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
