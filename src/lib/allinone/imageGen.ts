/**
 * 画像生成（キービジュアル・ペルソナ肖像）
 *
 * 優先度:
 *   1. Gemini 2.5 Pro Image Preview (Nano Banana Pro)  — GOOGLE_GENAI_API_KEY or GEMINI_API_KEY
 *   2. OpenAI DALL-E 3                                   — OPENAI_API_KEY
 *   3. SVG プレースホルダ                                — API キー何もなくても確実に返る
 */

import sharp from 'sharp'

const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview'

const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

export interface GenerateImageOptions {
  prompt: string
  aspectRatio?: '16:9' | '1:1' | '9:16' | '3:4' | '4:3'
  width?: number
  height?: number
  style?: 'photo' | 'illustration' | 'portrait' | 'brand'
  negativePrompt?: string
}

export interface GenerateImageResult {
  dataUrl: string        // data:image/png;base64,...
  mimeType: string
  width: number
  height: number
  provider: 'gemini' | 'openai' | 'svg'
  prompt: string
}

export async function generateImage(opts: GenerateImageOptions): Promise<GenerateImageResult> {
  // 1. Gemini Nano Banana
  try {
    const r = await generateWithGemini(opts)
    if (r) return r
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[allinone] gemini image gen failed:', err instanceof Error ? err.message : err)
  }

  // 2. OpenAI DALL-E 3
  try {
    const r = await generateWithOpenAI(opts)
    if (r) return r
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[allinone] openai image gen failed:', err instanceof Error ? err.message : err)
  }

  // 3. フォールバック SVG
  return await generateSvgPlaceholder(opts)
}

// ============================================
// Gemini Nano Banana
// ============================================

async function generateWithGemini(
  opts: GenerateImageOptions
): Promise<GenerateImageResult | null> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const res = await fetch(
    `${GEMINI_ENDPOINT(GEMINI_IMAGE_MODEL)}?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: [
                  opts.prompt,
                  opts.style === 'portrait'
                    ? 'Photorealistic portrait, Japanese person, professional headshot, soft natural lighting, neutral background.'
                    : '',
                  opts.style === 'brand'
                    ? 'Premium marketing key visual, composition for web hero banner, tasteful color palette.'
                    : '',
                  opts.aspectRatio ? `Aspect ratio ${opts.aspectRatio}.` : '',
                  opts.negativePrompt ? `Avoid: ${opts.negativePrompt}` : '',
                ]
                  .filter(Boolean)
                  .join(' '),
              },
            ],
          },
        ],
      }),
    }
  )

  if (!res.ok) return null
  const data = await res.json()
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? []
  for (const p of parts) {
    const inline = p?.inlineData || p?.inline_data
    if (inline?.data) {
      const mime = inline.mimeType || 'image/png'
      return {
        dataUrl: `data:${mime};base64,${inline.data}`,
        mimeType: mime,
        width: opts.width ?? 1024,
        height: opts.height ?? 576,
        provider: 'gemini',
        prompt: opts.prompt,
      }
    }
  }
  return null
}

// ============================================
// OpenAI DALL-E 3
// ============================================

async function generateWithOpenAI(
  opts: GenerateImageOptions
): Promise<GenerateImageResult | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const size =
    opts.aspectRatio === '16:9'
      ? '1792x1024'
      : opts.aspectRatio === '9:16'
      ? '1024x1792'
      : '1024x1024'

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: opts.prompt.slice(0, 3900),
      size,
      quality: 'standard',
      response_format: 'b64_json',
      n: 1,
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) return null
  const [w, h] = size.split('x').map(Number)
  return {
    dataUrl: `data:image/png;base64,${b64}`,
    mimeType: 'image/png',
    width: w,
    height: h,
    provider: 'openai',
    prompt: opts.prompt,
  }
}

// ============================================
// SVG フォールバック
// ============================================

async function generateSvgPlaceholder(
  opts: GenerateImageOptions
): Promise<GenerateImageResult> {
  const width = opts.aspectRatio === '9:16' ? 720 : opts.aspectRatio === '1:1' ? 1024 : 1280
  const height = opts.aspectRatio === '9:16' ? 1280 : opts.aspectRatio === '1:1' ? 1024 : 720
  const isPortrait = opts.style === 'portrait'

  const c1 = isPortrait ? '#F0ECFF' : '#7C5CFF'
  const c2 = isPortrait ? '#DCFCE7' : '#22D3EE'
  const c3 = '#00E5A0'
  const label = opts.prompt.slice(0, 80).replace(/[<>&"']/g, '')

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="50%" stop-color="${c2}"/>
        <stop offset="100%" stop-color="${c3}"/>
      </linearGradient>
      <radialGradient id="spot" cx="70%" cy="30%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect width="100%" height="100%" fill="url(#spot)"/>
    <g font-family="'Inter','Noto Sans JP',sans-serif" fill="#ffffff">
      <text x="${width / 2}" y="${height / 2 - 20}" font-size="${isPortrait ? 48 : 72}" font-weight="900" text-anchor="middle">ドヤマーケAI</text>
      <text x="${width / 2}" y="${height / 2 + 30}" font-size="${isPortrait ? 20 : 24}" text-anchor="middle" opacity="0.85">${label}</text>
    </g>
  </svg>`

  try {
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    return {
      dataUrl: `data:image/png;base64,${png.toString('base64')}`,
      mimeType: 'image/png',
      width,
      height,
      provider: 'svg',
      prompt: opts.prompt,
    }
  } catch {
    // sharp が失敗したら SVG のまま data URL
    return {
      dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      mimeType: 'image/svg+xml',
      width,
      height,
      provider: 'svg',
      prompt: opts.prompt,
    }
  }
}
