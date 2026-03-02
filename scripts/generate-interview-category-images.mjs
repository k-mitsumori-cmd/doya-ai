/**
 * インタビューテンプレートギャラリー用カテゴリサムネイル画像生成スクリプト
 *
 * Usage:
 *   node scripts/generate-interview-category-images.mjs
 *
 * .env.local の GOOGLE_GENAI_API_KEY を使用
 * 生成画像は public/interview/templates/ に保存
 */
import fs from 'node:fs'
import path from 'node:path'

// .env.local から API キーを読み込む
function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx < 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch { /* ignore */ }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'))
loadEnvFile(path.resolve(process.cwd(), '.env'))

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const apiKey = process.env.GOOGLE_GENAI_API_KEY
if (!apiKey) {
  console.error('GOOGLE_GENAI_API_KEY が設定されていません (.env.local)')
  process.exit(1)
}

const outDir = path.resolve(process.cwd(), 'public', 'interview', 'templates')
fs.mkdirSync(outDir, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --- フォールバックモデル候補 ---
const FALLBACK_MODELS = [
  'gemini-2.0-flash-preview-image-generation',
  'gemini-2.0-flash-exp',
]

async function resolveModel() {
  try {
    const res = await fetch(`${GEMINI_API_BASE}/models`, {
      headers: { 'x-goog-api-key': apiKey },
    })
    if (!res.ok) throw new Error(`ListModels failed: ${res.status}`)
    const json = await res.json()
    const models = (json.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name?.replace('models/', ''))
      .filter(Boolean)

    // banana 系を優先
    const banana = models.find((n) => n.toLowerCase().includes('banana'))
    if (banana) return banana

    // image 系 gemini-3
    const g3img = models.find(
      (n) => n.includes('image') && (n.includes('gemini-3') || n.includes('gemini3'))
    )
    if (g3img) return g3img

    // image 系
    const img = models.find((n) => n.includes('image'))
    if (img) return img
  } catch (e) {
    console.warn('ListModels failed, using fallback:', e.message)
  }
  return FALLBACK_MODELS[0]
}

// --- カテゴリ定義 ---
const CATEGORIES = [
  {
    id: 'it-technology',
    label: 'IT・テクノロジー',
    scene:
      'A futuristic modern technology workspace with multiple holographic displays showing data analytics dashboards, sleek minimalist desk with premium tech gadgets, server room visible through glass wall with blue LED lights',
    colors: 'electric blue and deep indigo gradient, cyan neon accents, cool futuristic tech palette',
    elements:
      'glowing circuit board patterns, floating holographic UI elements, fiber optic light trails, pristine mechanical keyboard, ultra-wide curved monitor',
    mood: 'innovative, cutting-edge, professional, digital transformation',
  },
  {
    id: 'medical-healthcare',
    label: '医療・ヘルスケア',
    scene:
      'A pristine modern medical research laboratory with advanced diagnostic equipment, clean white surfaces with soft ambient lighting, high-tech microscope station with DNA visualization on screen',
    colors: 'clean emerald green and teal, medical white, soft blue accents, calming healing atmosphere',
    elements:
      'DNA double helix hologram, premium stethoscope on marble surface, crystal clear test tubes with colorful solutions, medical data charts on tablet screen',
    mood: 'trustworthy, precise, caring, scientifically advanced',
  },
  {
    id: 'startup',
    label: 'スタートアップ',
    scene:
      'A vibrant creative startup office with an inspiring whiteboard covered in innovative flowcharts and sticky notes, energetic open-plan co-working space with modern furniture',
    colors: 'vibrant purple and violet gradient, electric orange accents, bold entrepreneurial energy',
    elements:
      'rocket ship model on desk, vision board with colorful post-it notes, MacBook showing pitch deck, artisan coffee cups, motivational poster frames',
    mood: 'dynamic, ambitious, disruptive, growth-oriented',
  },
  {
    id: 'finance',
    label: '金融・保険',
    scene:
      'A prestigious financial district office with panoramic city skyline view through floor-to-ceiling windows, polished mahogany desk with financial charts on multiple screens',
    colors: 'deep navy blue and gold, warm amber highlights, sophisticated corporate tones',
    elements:
      'stock market candlestick charts on screen, premium fountain pen on leather portfolio, gold coin stack, crystal award trophy, financial newspaper',
    mood: 'authoritative, trustworthy, premium, data-driven',
  },
  {
    id: 'manufacturing',
    label: '製造業',
    scene:
      'A state-of-the-art precision manufacturing facility with robotic arms and CNC machines, clean industrial environment with organized tool stations',
    colors: 'industrial steel gray and warm orange, metallic silver accents, professional workshop palette',
    elements:
      'precision engineered metal parts, robotic assembly arm, digital caliper, blueprint drawings, quality control instruments',
    mood: 'precision, reliability, craftsmanship, innovation',
  },
  {
    id: 'education',
    label: '教育',
    scene:
      'A beautiful modern university library with warm reading lamps, towering bookshelves, and a cozy study area with digital tablets and notebooks',
    colors: 'warm cyan and sky blue, scholarly brown and cream, inviting warm tones',
    elements:
      'stacks of academic books with golden light, digital tablet showing e-learning platform, globe, vintage desk lamp, colorful sticky tabs on textbook',
    mood: 'intellectual, inspiring, nurturing, knowledge-driven',
  },
  {
    id: 'retail-ec',
    label: '小売・EC',
    scene:
      'A stylish modern e-commerce fulfillment center and product photography studio, beautifully arranged product displays with professional lighting setup',
    colors: 'vibrant coral pink and rose, modern retail aesthetic, warm commercial tones',
    elements:
      'elegantly packaged products, shopping bags with tissue paper, product flat lay arrangement, barcode scanner, shipping boxes with branded tape',
    mood: 'trendy, consumer-friendly, exciting, brand-forward',
  },
  {
    id: 'realestate',
    label: '不動産',
    scene:
      'A luxurious modern apartment interior with floor-to-ceiling windows overlooking a city skyline at golden hour, elegant interior design with premium materials',
    colors: 'warm green and emerald, luxurious gold accents, sophisticated earth tones',
    elements:
      'architectural floor plans on table, miniature building model, premium fabric swatches, key on marble countertop, aerial city view',
    mood: 'luxurious, aspirational, stable, investment-worthy',
  },
]

function buildPrompt(cat) {
  return `Create a stunning, photorealistic editorial banner image for a "${cat.label}" industry template gallery.

SCENE: ${cat.scene}

COLOR PALETTE: ${cat.colors}
KEY VISUAL ELEMENTS: ${cat.elements}
MOOD & ATMOSPHERE: ${cat.mood}

PHOTOGRAPHY STYLE:
- Shot on Canon EOS R5, 35mm f/1.4, cinematic depth of field
- Natural window light mixed with dramatic accent lighting, editorial quality
- Rule of thirds composition with strong visual hierarchy
- Shallow depth of field with beautiful bokeh

CRITICAL REQUIREMENTS:
- PHOTOREALISTIC quality — must look like a real professional photograph
- NO human faces, NO people, NO text, NO logos, NO watermarks, NO letters
- Instead of people: use objects, architecture, technology, workspaces, equipment
- Aspect ratio: 16:9 wide landscape format
- Magazine editorial / premium business media hero image quality
- Rich detail and textures, high dynamic range
- Professional color grading matching the specified palette

OUTPUT: A single ultra-high-quality photorealistic 16:9 landscape image suitable as a category banner for a premium business template gallery.`
}

async function generateImage(model, cat) {
  const prompt = buildPrompt(cat)
  const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      temperature: 1.0,
      candidateCount: 1,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`API error ${res.status}: ${t.slice(0, 300)}`)
  }

  const json = await res.json()

  const blockReason = json?.candidates?.[0]?.finishReason
  if (blockReason === 'SAFETY' || blockReason === 'BLOCKED') {
    throw new Error(`Blocked by safety filter: ${blockReason}`)
  }

  const parts = json?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) {
    throw new Error('No image parts in response')
  }

  for (const part of parts) {
    const inline = part?.inlineData || part?.inline_data
    if (inline?.data) {
      return Buffer.from(inline.data, 'base64')
    }
  }

  throw new Error('No image data found in response')
}

// --- メイン処理 ---
async function main() {
  const model = await resolveModel()
  console.log(`Using model: ${model}`)
  console.log(`Output dir: ${outDir}`)
  console.log()

  for (const cat of CATEGORIES) {
    const outPath = path.join(outDir, `${cat.id}.png`)

    // 既に存在する場合はスキップ（上書きしたい場合は --force）
    if (fs.existsSync(outPath) && !process.argv.includes('--force')) {
      console.log(`[SKIP] ${cat.label} → ${outPath} (already exists, use --force to overwrite)`)
      continue
    }

    console.log(`[GEN] ${cat.label} ...`)
    try {
      const buf = await generateImage(model, cat)
      fs.writeFileSync(outPath, buf)
      console.log(`  ✓ Saved: ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`)
    } catch (e) {
      console.error(`  ✗ Failed: ${e.message}`)
    }

    // レート制限対策で少し間隔を空ける
    await sleep(3000)
  }

  console.log('\nDone!')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
