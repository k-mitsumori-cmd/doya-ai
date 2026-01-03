import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 512,
  height: 512,
}

export const contentType = 'image/png'

// ============================================
// Site Icon (App Router)
// - User-provided design: blue rounded square + rocket + "AI"
// ============================================
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
        }}
      >
        <div
          style={{
            width: 420,
            height: 420,
            borderRadius: 72,
            background: 'linear-gradient(180deg, #1674FF 0%, #0B57E3 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Rocket */}
          <svg
            width="280"
            height="280"
            viewBox="0 0 280 280"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: 'absolute', top: 70, left: 70 }}
          >
            {/* Body */}
            <path
              d="M170 46c32 22 54 56 58 96-28 4-52 10-78 24l-12-10c7-24 16-48 24-78-8-6-18-12-26-18 10-6 22-12 34-14z"
              fill="#FFFFFF"
            />
            {/* Nose cone */}
            <path d="M216 54c16 10 28 24 34 40-18-4-34-12-48-22l14-18z" fill="#FFFFFF" />
            {/* Window */}
            <circle cx="186" cy="92" r="18" fill="#1674FF" />
            <circle cx="186" cy="92" r="14" fill="#FFFFFF" />
            <circle cx="186" cy="92" r="12" fill="#1674FF" />
            {/* Wing */}
            <path d="M118 124c-16 2-30 10-40 20l26 26c8-10 14-24 14-46z" fill="#FFFFFF" />
            {/* Bottom fin */}
            <path d="M146 196c-20 8-38 6-54-6 8-18 24-34 42-42l12 48z" fill="#FFFFFF" />
            {/* Flame */}
            <path
              d="M104 200c-20 18-26 40-18 58 20-2 38-14 54-34-10 2-22-2-36-24z"
              fill="#FFFFFF"
            />
          </svg>

          {/* AI text */}
          <div
            style={{
              position: 'absolute',
              bottom: 46,
              width: '100%',
              textAlign: 'center',
              color: '#FFFFFF',
              fontSize: 78,
              fontWeight: 800,
              letterSpacing: 1,
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
            }}
          >
            AI
          </div>
        </div>
      </div>
    ),
    size
  )
}


