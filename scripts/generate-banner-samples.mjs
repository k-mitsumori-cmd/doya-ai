import fs from 'node:fs'
import path from 'node:path'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MODEL = 'gemini-2.0-flash-exp' // Nano Banana Pro (Gemini 2.0 Flash)

// ドヤバナーAI branding
const BRAND_NAME = 'ドヤバナーAI'

const apiKey = process.env.GOOGLE_GENAI_API_KEY || null

const outDir = path.resolve(process.cwd(), 'public', 'banner-samples')
fs.mkdirSync(outDir, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function safeName(s) {
  return String(s).replace(/[^a-zA-Z0-9._-]+/g, '-')
}

function getAspectRatio(size) {
  const [w, h] = String(size).split('x').map((v) => Number(v))
  if (!w || !h) return '1:1'
  const ratio = w / h
  if (ratio > 1.7) return '16:9'
  if (ratio > 1.4) return '3:2'
  if (ratio > 1.1) return '4:3'
  if (ratio < 0.6) return '9:16'
  if (ratio < 0.75) return '2:3'
  if (ratio < 0.9) return '3:4'
  return '1:1'
}

function buildPrompt({
  id,
  title,
  keyword,
  subText,
  cta,
  colors,
  style,
  size,
}) {
  const [w, h] = String(size).split('x')
  const aspect = getAspectRatio(size)
  const isYouTube = id.includes('youtube')
  const isSnsAd = id.includes('sns_ad')

  if (isYouTube) {
    return [
      'Create a HIGH-CLICK-RATE YouTube thumbnail image WITH BOLD TEXT.',
      '',
      '=== YOUTUBE THUMBNAIL SPEC ===',
      `Canvas: ${w}x${h} pixels (16:9)`,
      'Market: Japan',
      '',
      '=== REQUIRED TEXT (MAXIMUM IMPACT) ===',
      `MAIN HEADLINE: "${keyword}" (Make this HUGE and expressive)`,
      subText ? `SUB TEXT: "${subText}"` : '',
      '',
      '=== DESIGN GOAL ===',
      'This must look like a high-performing YouTube thumbnail that stops the scroll.',
      'Use bright, saturated colors and high contrast.',
      '',
      '=== STYLE ===',
      'YouTube thumbnail style: extreme high-impact, big emotional hook, expressive layout.',
      'Include a placeholder for an expressive human face or reaction on the left side.',
      '',
      '=== COLOR PALETTE ===',
      colors && colors.length ? colors.join(', ') : 'vibrant yellow, red, and blue',
      '',
      '=== TYPOGRAPHY RULES ===',
      '- Use EXTREMELY BOLD, thick Gothic Japanese font',
      '- Add thick borders/outlines to text (e.g., white text with black/red border)',
      '- Tilt text slightly for dynamic feel',
      '- Ensure text is readable even at small size',
      '',
      '=== COMPOSITION ===',
      '- Center-right: Massive headline text',
      '- Left side: Impactful visual element (human reaction/expressive icon)',
      '- Use rays, gradients, or arrows to direct attention',
      '',
      'Generate the YouTube thumbnail now.',
    ].join('\n')
  }

  return [
    `Create a professional ${isSnsAd ? 'SNS advertisement' : 'marketing'} banner image WITH TEXT.`,
    '',
    '=== BANNER SPEC ===',
    `Canvas: ${w}x${h} pixels, aspect ${aspect}`,
    'Market: Japan',
    '',
    '=== REQUIRED TEXT (MUST BE PERFECTLY LEGIBLE) ===',
    `Main headline: "${keyword}"`,
    subText ? `Sub text: "${subText}"` : '',
    cta ? `CTA button text: "${cta}"` : '',
    '',
    '=== DESIGN GOAL ===',
    `This is a professional SAMPLE banner: ${title}`,
    'Make it look like a real high-conversion ad (not a stock photo).',
    'Use modern ad layout, clean panels, and high-impact visual hierarchy.',
    '',
    '=== STYLE ===',
    style || 'modern, clean, high-contrast, premium ad style',
    isSnsAd ? 'SNS ad style: eye-catching, mobile-first, vibrant colors.' : '',
    '',
    '=== COLOR PALETTE ===',
    colors && colors.length ? colors.join(', ') : 'Bunridge blue (#2563EB), orange (#F97316), and white',
    '',
    '=== TYPOGRAPHY RULES ===',
    '- Use bold, modern Gothic (sans-serif) Japanese font',
    '- Place text on solid or semi-transparent rectangular panels for 100% legibility',
    '- Clear hierarchy: Headline must be 2x larger than sub text',
    '',
    '=== COMPOSITION ===',
    '- Clear visual focal point (product, person, or icon)',
    '- Structured text area with high contrast',
    '- CTA button must look clickable with depth/shadow',
    '',
    'Generate the professional ad banner now.',
  ]
    .filter(Boolean)
    .join('\n')
}

async function generateImage(prompt, size) {
  const endpoint = `${GEMINI_API_BASE}/models/${MODEL}:generateContent`
  const aspectRatio = getAspectRatio(size)

  const res = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        // aspectRatio is sometimes restricted in exp models
      },
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Gemini error ${res.status}: ${t.substring(0, 500)}`)
  }

  const json = await res.json()
  const parts = json?.candidates?.[0]?.content?.parts || []
  for (const p of parts) {
    if (p?.inlineData?.data) {
      const mime = p.inlineData.mimeType || 'image/png'
      const buf = Buffer.from(p.inlineData.data, 'base64')
      return { mime, buf }
    }
  }
  throw new Error('No image returned')
}

const samples = [
  // Purposes (7)
  {
    id: 'purpose-sns_ad',
    title: 'SNS広告',
    size: '1080x1080',
    keyword: '初回20%OFF 今だけ',
    subText: '予約はカンタン1分',
    cta: '今すぐチェック',
    colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'],
    style: 'thumb-stopping social ad, bold blocks, strong CTA',
  },
  {
    id: 'purpose-youtube',
    title: 'YouTubeサムネイル',
    size: '1280x720',
    keyword: '保存版：広告が伸びる型',
    subText: '今日から使える3つ',
    cta: '',
    colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'],
    style: 'YouTube thumbnail, high contrast, big headline, dynamic shapes',
  },
  {
    id: 'purpose-display',
    title: 'ディスプレイ',
    size: '300x250',
    keyword: '無料診断',
    subText: 'CV改善',
    cta: '詳しく',
    colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'],
    style: 'display ad, minimal, clear hierarchy for small sizes',
  },
  {
    id: 'purpose-webinar',
    title: 'ウェビナー',
    size: '1920x1080',
    keyword: 'ウェビナー：デジタルマーケの未来',
    subText: '参加無料｜10/26 20:00',
    cta: '今すぐ登録',
    colors: ['#0B1220', '#2563EB', '#7C3AED', '#FFFFFF'],
    style: 'webinar hero banner, premium gradient, speaker cards area',
  },
  {
    id: 'purpose-lp_hero',
    title: 'LPヒーロー',
    size: '1920x600',
    keyword: '業務効率を10倍に',
    subText: 'AIで毎日の作業を自動化',
    cta: '無料で試す',
    colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'],
    style: 'landing page hero, wide composition, clean premium',
  },
  {
    id: 'purpose-email',
    title: 'メールヘッダー',
    size: '600x200',
    keyword: '会員限定クーポン',
    subText: '本日23:59まで',
    cta: '',
    colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'],
    style: 'email header, lightweight, simple clear message',
  },
  {
    id: 'purpose-campaign',
    title: 'キャンペーン',
    size: '1200x628',
    keyword: '決算セール MAX70%OFF',
    subText: '本日限り',
    cta: '今すぐ購入',
    colors: ['#0B1220', '#EF4444', '#F59E0B', '#FFFFFF'],
    style: 'campaign sale banner, urgency, burst shapes',
  },

  // Categories (12) — unified size for preview
  { id: 'cat-telecom', title: '通信', size: '1200x628', keyword: '乗り換えで2万円還元', subText: '月額990円〜', cta: '詳細はこちら', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'], style: 'telco, speed lines, tech' },
  { id: 'cat-marketing', title: 'マーケ', size: '1200x628', keyword: '広告費ムダ打ち0へ', subText: 'CV改善の無料診断', cta: '今すぐチェック', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'], style: 'b2b marketing, graphs, credibility' },
  { id: 'cat-ec', title: 'EC', size: '1200x628', keyword: '本日限定 20%OFF', subText: '人気No.1セット', cta: '今すぐ購入', colors: ['#F97316', '#EF4444', '#FFFFFF', '#0B1220'], style: 'ecommerce, product showcase, urgency' },
  { id: 'cat-recruit', title: '採用', size: '1200x628', keyword: '未経験OK 積極採用', subText: 'まずはカジュアル面談', cta: '応募する', colors: ['#22C55E', '#2563EB', '#FFFFFF', '#0B1220'], style: 'recruiting, friendly, trustworthy' },
  { id: 'cat-beauty', title: '美容', size: '1200x628', keyword: '新規¥0体験あり', subText: '30分で印象UP', cta: '予約する', colors: ['#EC4899', '#F472B6', '#FFFFFF', '#0B1220'], style: 'beauty, elegant, soft glow' },
  { id: 'cat-food', title: '飲食', size: '1200x628', keyword: '初回限定 20%OFF', subText: '人気No.1セット', cta: '注文する', colors: ['#EF4444', '#F97316', '#FFFFFF', '#0B1220'], style: 'food, appetizing, warm' },
  { id: 'cat-realestate', title: '不動産', size: '1200x628', keyword: '理想の住まい探し', subText: '内見予約はオンライン', cta: '相談する', colors: ['#14B8A6', '#06B6D4', '#FFFFFF', '#0B1220'], style: 'real estate, calm, stable' },
  { id: 'cat-education', title: '教育', size: '1200x628', keyword: '最短で資格合格へ', subText: '無料体験受付中', cta: '無料で試す', colors: ['#6366F1', '#2563EB', '#FFFFFF', '#0B1220'], style: 'education, inspiring, clean' },
  { id: 'cat-finance', title: '金融', size: '1200x628', keyword: '家計を月1万円改善', subText: '無料相談受付中', cta: '相談する', colors: ['#0B1220', '#F59E0B', '#FFFFFF', '#2563EB'], style: 'finance, trustworthy, premium' },
  { id: 'cat-health', title: '医療', size: '1200x628', keyword: '予約から問診まで', subText: '現場をもっとラクに', cta: '詳しく', colors: ['#06B6D4', '#14B8A6', '#FFFFFF', '#0B1220'], style: 'medical, clean, caring' },
  { id: 'cat-it', title: 'IT', size: '1200x628', keyword: '業務効率を10倍に', subText: '次世代AIプラットフォーム', cta: '無料で試す', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'], style: 'IT, modern, digital' },
  { id: 'cat-other', title: 'その他', size: '1200x628', keyword: '今すぐ成果を出す', subText: '無料で始める', cta: '詳しく', colors: ['#64748B', '#2563EB', '#FFFFFF', '#0B1220'], style: 'versatile, modern, clean' },

  // Size samples (keys used in SIZE_INFO)
  { id: 'size-1080x1080', title: 'サイズ 1080x1080', size: '1080x1080', keyword: 'フィードで目立つ', subText: '正方形の定番', cta: '今すぐ', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'] },
  { id: 'size-1200x628', title: 'サイズ 1200x628', size: '1200x628', keyword: 'リンクで伸ばす', subText: 'OGP最適', cta: '詳しく', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'] },
  { id: 'size-1080x1920', title: 'サイズ 1080x1920', size: '1080x1920', keyword: '全画面で刺す', subText: 'ストーリー向け', cta: 'スワイプ', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'] },
  { id: 'size-1280x720', title: 'サイズ 1280x720', size: '1280x720', keyword: 'クリックされる型', subText: '16:9', cta: '', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'] },
  { id: 'size-1920x1080', title: 'サイズ 1920x1080', size: '1920x1080', keyword: 'イベント告知', subText: '高解像度', cta: '申込', colors: ['#0B1220', '#2563EB', '#7C3AED', '#FFFFFF'] },
  { id: 'size-300x250', title: 'サイズ 300x250', size: '300x250', keyword: '無料', subText: '診断', cta: '詳しく', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'] },
  { id: 'size-728x90', title: 'サイズ 728x90', size: '728x90', keyword: '今だけ', subText: '限定', cta: '', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'] },
  { id: 'size-320x50', title: 'サイズ 320x50', size: '320x50', keyword: 'タップ', subText: '簡単', cta: '', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'] },
  { id: 'size-1920x600', title: 'サイズ 1920x600', size: '1920x600', keyword: 'ファーストビュー', subText: 'ワイド', cta: '無料で試す', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'] },
  { id: 'size-1200x800', title: 'サイズ 1200x800', size: '1200x800', keyword: 'バランス良く', subText: '3:2', cta: '詳しく', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'] },
  { id: 'size-600x200', title: 'サイズ 600x200', size: '600x200', keyword: 'クーポン配布', subText: '本日まで', cta: '', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'] },
  { id: 'size-600x300', title: 'サイズ 600x300', size: '600x300', keyword: 'クリック率UP', subText: 'メール内', cta: '詳しく', colors: ['#2563EB', '#06B6D4', '#FFFFFF', '#0B1220'] },
]

async function main() {
  const force = process.argv.includes('--force')
  const generateSvgOnly = process.argv.includes('--svg')
  console.log(`Output dir: ${outDir}`)
  console.log(`Total samples: ${samples.length}`)

  // Always generate small SVG placeholders (so UI never breaks).
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    const svgFile = path.join(outDir, `${safeName(s.id)}.svg`)
    if (!force && fs.existsSync(svgFile)) continue

    const [w, h] = String(s.size).split('x').map((v) => Number(v))
    const width = Number.isFinite(w) && w > 0 ? w : 1200
    const height = Number.isFinite(h) && h > 0 ? h : 628

    const headline = String(s.keyword || '').slice(0, 40)
    const sub = String(s.subText || '').slice(0, 40)
    const cta = String(s.cta || '').slice(0, 16)
    const c1 = (s.colors && s.colors[0]) || '#2563EB' // Primary Blue
    const c2 = (s.colors && s.colors[1]) || '#F97316' // Accent Orange
    const c3 = (s.colors && s.colors[2]) || '#FFFFFF' // White
    const c4 = (s.colors && s.colors[3]) || '#0F172A' // Dark Slate

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c4}"/>
      <stop offset="60%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="#1E40AF"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${c3}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${c3}" stop-opacity="0.06"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000000" flood-opacity="0.28"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" rx="${Math.round(Math.min(width, height) * 0.05)}" fill="url(#bg)"/>

  <!-- abstract grid -->
  <g opacity="0.1">
    ${Array.from({ length: 12 }).map((_, idx) => {
      const x = Math.round((width / 12) * idx)
      return `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${c3}" stroke-width="1" />`
    }).join('\n')}
  </g>

  <!-- headline panel -->
  <rect x="${Math.round(width * 0.06)}" y="${Math.round(height * 0.16)}" width="${Math.round(width * 0.58)}" height="${Math.round(height * 0.44)}" rx="${Math.round(height * 0.06)}" fill="url(#panel)" stroke="${c3}" stroke-opacity="0.14" filter="url(#shadow)"/>

  <!-- headline text -->
  <text x="${Math.round(width * 0.09)}" y="${Math.round(height * 0.30)}"
        fill="${c3}" font-family="ui-sans-serif, system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', sans-serif"
        font-size="${Math.round(height * 0.10)}" font-weight="800">
    ${headline.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  </text>
  ${sub ? `<text x="${Math.round(width * 0.09)}" y="${Math.round(height * 0.42)}"
        fill="${c3}" opacity="0.88"
        font-family="ui-sans-serif, system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', sans-serif"
        font-size="${Math.round(height * 0.048)}" font-weight="700">
    ${sub.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  </text>` : ''}

  <!-- right decoration: accent bars (Bunridge style) -->
  <g transform="translate(${Math.round(width * 0.70)} ${Math.round(height * 0.18)})">
    <rect x="0" y="0" width="${Math.round(width * 0.04)}" height="${Math.round(height * 0.28)}" rx="4" fill="${c2}"/>
    <rect x="${Math.round(width * 0.06)}" y="${Math.round(height * 0.08)}" width="${Math.round(width * 0.04)}" height="${Math.round(height * 0.20)}" rx="4" fill="#FBBF24"/>
    <rect x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.12)}" width="${Math.round(width * 0.04)}" height="${Math.round(height * 0.16)}" rx="4" fill="${c2}" opacity="0.6"/>
  </g>

  <!-- CTA -->
  ${cta ? `
  <g filter="url(#shadow)">
    <rect x="${Math.round(width * 0.68)}" y="${Math.round(height * 0.72)}"
          width="${Math.round(width * 0.26)}" height="${Math.round(height * 0.16)}"
          rx="${Math.round(height * 0.06)}" fill="#FBBF24"/>
    <text x="${Math.round(width * 0.70)}" y="${Math.round(height * 0.82)}"
          fill="${c4}" font-family="ui-sans-serif, system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', sans-serif"
          font-size="${Math.round(height * 0.065)}" font-weight="900">
      ${cta.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
    </text>
  </g>` : ''}

  <!-- footer label -->
  <text x="${Math.round(width * 0.06)}" y="${Math.round(height * 0.92)}"
        fill="${c3}" opacity="0.55"
        font-family="ui-sans-serif, system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', sans-serif"
        font-size="${Math.round(height * 0.038)}" font-weight="700">
    SAMPLE BANNER (${safeName(s.id)})
  </text>
</svg>`

    fs.writeFileSync(svgFile, svg)
  }

  if (generateSvgOnly) {
    console.log('SVG placeholders generated. (Skipped PNG generation because --svg was passed.)')
    return
  }

  if (!apiKey) {
    console.log('SVG placeholders generated. To generate Nano Banana Pro PNGs, set GOOGLE_GENAI_API_KEY and re-run.')
    return
  }

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    const file = path.join(outDir, `${safeName(s.id)}.png`)
    if (!force && fs.existsSync(file)) {
      console.log(`[skip] ${s.id}`)
      continue
    }

    const prompt = buildPrompt(s)
    console.log(`[${i + 1}/${samples.length}] generating ${s.id} (${s.size})...`)
    const { buf } = await generateImage(prompt, s.size)
    fs.writeFileSync(file, buf)
    console.log(`  -> wrote ${path.relative(process.cwd(), file)} (${buf.length} bytes)`)
    await sleep(2200)
  }

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


