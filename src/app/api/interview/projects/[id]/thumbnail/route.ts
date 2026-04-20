// ============================================
// POST /api/interview/projects/[id]/thumbnail
// Gemini画像生成でプロジェクトサムネイルを生成
// ============================================
// 記事内容・文字起こしテキストを分析して
// コンテンツに最適なフォトリアリスティックサムネイルを自動生成

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'
import { callGeminiImageAPI } from '@/lib/resolve-image-model'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

// ジャンルに応じたビジュアルシーン（写真風）
const GENRE_SCENES: Record<string, string> = {
  CASE_STUDY: 'a professional modern glass office building interior with warm golden hour lighting streaming through floor-to-ceiling windows, sleek conference table with laptops, ambient city skyline bokeh in background',
  PRODUCT_INTERVIEW: 'a clean minimalist product photography studio with soft gradient backdrop, elegant tech gadgets arranged artistically, dramatic rim lighting with shallow depth of field',
  PERSONA_INTERVIEW: 'an atmospheric portrait studio with soft moody lighting, elegant leather armchair, warm bokeh string lights in background, professional microphone on vintage wooden desk',
  PANEL_DISCUSSION: 'a sophisticated modern conference stage with dramatic spotlights, elegant podium, blurred audience silhouettes, professional event photography with cinematic depth',
  EVENT_REPORT: 'a vibrant creative conference venue with colorful ambient lighting, modern architectural elements, dynamic crowd energy captured with motion blur, professional event photography',
  OTHER: 'a beautifully lit creative workspace with plants, warm wooden desk, soft natural window light with bokeh, artistic stationery arrangement, editorial photography style',
}

// ジャンルに応じたカラーパレット
const GENRE_COLORS: Record<string, string> = {
  CASE_STUDY: 'corporate blue and warm gold tones, professional navy accents',
  PRODUCT_INTERVIEW: 'clean white and silver, subtle tech-blue highlights, modern gradient',
  PERSONA_INTERVIEW: 'warm amber and cream tones, soft mocha accents, intimate warmth',
  PANEL_DISCUSSION: 'deep purple and electric blue stage lighting, dramatic contrast',
  EVENT_REPORT: 'vibrant coral and teal, energetic warm yellows, festival atmosphere',
  OTHER: 'earthy sage green and warm wood tones, natural sunlight warmth',
}

// ランダム性のための多様なスタイル配列
const CAMERA_STYLES = [
  'Shot on Canon EOS R5, 85mm f/1.2 portrait lens, creamy bokeh',
  'Shot on Sony A7R V, 24mm f/1.4 wide angle, dramatic perspective',
  'Shot on Hasselblad X2D, 90mm f/3.2, medium format film-like quality',
  'Shot on Fujifilm GFX 100S, 45mm f/2.8, Fuji color science warmth',
  'Shot on Nikon Z9, 50mm f/1.2, razor sharp with smooth transitions',
  'Shot on Leica SL2, 35mm f/1.4 Summilux, classic Leica rendering',
  'Shot on Phase One IQ4, 120mm f/4 macro, incredible detail and texture',
  'Shot on Canon EOS R3, 135mm f/1.8, beautiful subject isolation',
]

const COMPOSITION_STYLES = [
  'Rule of thirds composition with strong leading lines',
  'Central symmetrical composition with balanced framing',
  'Diagonal dynamic composition creating visual tension',
  'Overhead flat lay arrangement with geometric patterns',
  'Low angle dramatic perspective looking upward',
  'Dutch angle slight tilt for creative energy',
  'Frame within a frame composition through architectural elements',
  'Minimalist negative space composition with subject off-center',
  'Golden spiral composition with natural flow',
  'Layered foreground-midground-background depth composition',
]

const LIGHTING_STYLES = [
  'Golden hour warm directional sunlight with long shadows',
  'Dramatic Rembrandt lighting with single key light source',
  'Soft diffused overcast natural light, even and gentle',
  'Neon-accented cyberpunk ambient glow with color contrast',
  'Blue hour twilight with cool ambient tones',
  'High-key bright studio lighting with minimal shadows',
  'Chiaroscuro dramatic contrast between light and dark',
  'Backlit silhouette rim lighting with lens flare',
  'Window light with venetian blind shadow patterns',
  'Candlelit warm intimate glow with deep shadows',
  'Split lighting half-face dramatic effect',
  'Soft loop lighting with butterfly catchlights',
]

const ART_DIRECTIONS = [
  'Editorial style like Wired magazine, modern and tech-forward',
  'Forbes business editorial, premium and authoritative',
  'National Geographic documentary style, rich and immersive',
  'Kinfolk lifestyle aesthetic, minimal and organic',
  'Monocle magazine style, sophisticated and global',
  'Architectural Digest interior style, luxurious and detailed',
  'VSCO film emulation, slightly faded vintage tones',
  'High fashion editorial, bold colors and dramatic mood',
  'Scandinavian design aesthetic, clean and functional',
  'Japanese wabi-sabi aesthetic, imperfect natural beauty',
]

const COLOR_TREATMENTS = [
  'Warm vintage film tones with lifted blacks and amber highlights',
  'Cool modern teal and orange color grading',
  'High contrast vivid saturated colors, punchy and bold',
  'Muted pastel desaturated palette, soft and dreamy',
  'Monochromatic with single accent color pop',
  'Earth tones with olive, terracotta, and warm beige',
  'Jewel tones with deep emerald, sapphire, and ruby accents',
  'Sunset gradient warm-to-cool color transition',
  'Clean neutral palette with crisp whites and soft grays',
  'Cinematic color grading with crushed blacks and teal shadows',
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * テキストからキーワードを抽出して視覚的要素に変換
 */
function extractVisualKeywords(text: string): string {
  if (!text || text.length < 50) return ''

  // テキストの冒頭500文字を分析
  const sample = text.slice(0, 500)

  const visualHints: string[] = []

  // ビジネス・テクノロジー関連
  if (/DX|デジタル|テクノロジー|AI|IT|クラウド|SaaS|アプリ/i.test(sample)) {
    visualHints.push('futuristic holographic data visualization, glowing circuit board patterns')
  }
  if (/経営|CEO|代表|社長|起業|ベンチャー|スタートアップ/i.test(sample)) {
    visualHints.push('elegant executive desk accessories, premium fountain pen on leather notebook')
  }
  if (/製造|工場|モノづくり|ものづくり|製品/i.test(sample)) {
    visualHints.push('precision engineering workshop with metallic textures, CNC machine close-up')
  }
  if (/教育|学校|大学|学生|研究/i.test(sample)) {
    visualHints.push('beautiful library interior with warm reading lamps, stacks of books with golden light')
  }
  if (/医療|健康|病院|クリニック|ヘルスケア/i.test(sample)) {
    visualHints.push('modern medical facility with clean white surfaces, subtle blue ambient lighting')
  }
  if (/食|レストラン|料理|カフェ|フード/i.test(sample)) {
    visualHints.push('artisanal food photography with natural ingredients, warm kitchen ambiance')
  }
  if (/デザイン|クリエイティブ|アート|建築/i.test(sample)) {
    visualHints.push('creative studio with art supplies, colorful mood boards, architectural models')
  }
  if (/環境|サステナブル|SDGs|エコ|自然/i.test(sample)) {
    visualHints.push('lush green nature with morning dew, sustainable materials, organic textures')
  }
  if (/マーケティング|広告|ブランド|PR|SNS/i.test(sample)) {
    visualHints.push('creative marketing brainstorm wall with sticky notes, modern whiteboard with strategies')
  }
  if (/チーム|組織|人事|採用|働き方/i.test(sample)) {
    visualHints.push('collaborative modern co-working space, warm team meeting atmosphere')
  }

  return visualHints.length > 0
    ? `CONTENT-SPECIFIC ELEMENTS: ${visualHints.slice(0, 2).join(', ')}`
    : ''
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const id = await resolveId(ctx)
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    // リクエストボディから記事内容・タイトルを受け取る（オプション）
    let articleContent = ''
    let articleTitle = ''
    try {
      const body = await req.json()
      articleContent = body?.articleContent || ''
      articleTitle = body?.articleTitle || ''
    } catch {
      // ボディなしの場合は無視
    }

    const project = await prisma.interviewProject.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        guestId: true,
        title: true,
        genre: true,
        theme: true,
        intervieweeName: true,
        intervieweeCompany: true,
        intervieweeRole: true,
        thumbnailUrl: true,
      },
    })

    if (!project) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(project, userId, guestId)
    if (ownerErr) return ownerErr

    const apiKey = process.env.GOOGLE_GENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'APIキーが設定されていません' }, { status: 500 })
    }

    // 記事内容・タイトルがなければDBから最新ドラフトまたは文字起こしを取得
    if (!articleContent || !articleTitle) {
      const latestDraft = await prisma.interviewDraft.findFirst({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        select: { title: true, content: true },
      })
      if (latestDraft) {
        if (!articleTitle && latestDraft.title) articleTitle = latestDraft.title
        if (!articleContent && latestDraft.content) articleContent = latestDraft.content
      }
      if (!articleContent) {
        // 文字起こしテキストを使用
        const transcriptions = await prisma.interviewTranscription.findMany({
          where: { material: { projectId: id }, status: 'COMPLETED' },
          select: { text: true },
        })
        articleContent = transcriptions.map(t => t.text).filter(Boolean).join('\n').slice(0, 1000)
      }
    }

    // ジャンルに応じたシーン
    const genre = project.genre || 'OTHER'
    const genreScene = GENRE_SCENES[genre] || GENRE_SCENES.OTHER
    const genreColors = GENRE_COLORS[genre] || GENRE_COLORS.OTHER

    // 記事内容からビジュアルキーワードを抽出
    const contentKeywords = extractVisualKeywords(articleContent)

    // テーマ情報（記事タイトル優先）
    const mainTitle = articleTitle || project.theme || project.title
    const themeInfo = [
      mainTitle,
      project.intervieweeName ? `Person: ${project.intervieweeName}` : '',
      project.intervieweeCompany ? `Company: ${project.intervieweeCompany}` : '',
      project.intervieweeRole ? `Role: ${project.intervieweeRole}` : '',
    ].filter(Boolean).join(' | ')

    // ランダムスタイルを選択（毎回異なるビジュアルを生成）
    const camera = pickRandom(CAMERA_STYLES)
    const composition = pickRandom(COMPOSITION_STYLES)
    const lighting = pickRandom(LIGHTING_STYLES)
    const artDirection = pickRandom(ART_DIRECTIONS)
    const colorTreatment = pickRandom(COLOR_TREATMENTS)

    // プロンプト構築（フォトリアリスティック・雑誌クオリティ + ランダム性）
    const prompt = `Create a stunning, photorealistic editorial thumbnail image for a professional interview article.

ARTICLE TITLE: "${mainTitle}"
ARTICLE CONTEXT: ${themeInfo}
${contentKeywords}

IMPORTANT: The image should visually represent the theme and mood of this article title. Choose objects, scenes, and atmosphere that directly relate to "${mainTitle}".

PRIMARY SCENE: ${genreScene}
COLOR PALETTE: ${genreColors}

CAMERA & LENS: ${camera}
COMPOSITION: ${composition}
LIGHTING: ${lighting}
ART DIRECTION: ${artDirection}
COLOR TREATMENT: ${colorTreatment}

CRITICAL REQUIREMENTS:
- PHOTOREALISTIC quality — must look like a real photograph
- NO human faces, NO people, NO text, NO logos, NO watermarks
- Instead of people, use: objects, architecture, interiors, nature, technology, workspaces
- Aspect ratio: 16:9 landscape
- Magazine cover / editorial hero image quality

OUTPUT: A single ultra-high-quality photorealistic image that would be suitable as a hero banner for a premium business media website.`

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
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

    const { response, model } = await callGeminiImageAPI(apiKey, requestBody)

    const result = await response.json()

    // ブロックされた場合のチェック
    const blockReason = result?.candidates?.[0]?.finishReason
    if (blockReason === 'SAFETY' || blockReason === 'BLOCKED') {
      console.error('[thumbnail] Content blocked by safety filter:', JSON.stringify(result?.candidates?.[0]?.safetyRatings))
      return NextResponse.json({ success: false, error: '安全性フィルターにより画像生成がブロックされました。再度お試しください。' }, { status: 400 })
    }

    // 画像データを抽出
    const parts = result?.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts)) {
      console.error('[thumbnail] No image parts in response. finishReason:', blockReason, 'response snippet:', JSON.stringify(result).slice(0, 500))
      return NextResponse.json({ success: false, error: '画像データが見つかりません。再度お試しください。' }, { status: 500 })
    }

    for (const part of parts) {
      const inline = part?.inlineData || part?.inline_data
      if (inline?.data && typeof inline.data === 'string') {
        const mimeType = inline?.mimeType || 'image/png'
        const thumbnailUrl = `data:${mimeType};base64,${inline.data}`

        // DBに保存
        await prisma.interviewProject.update({
          where: { id },
          data: { thumbnailUrl },
        })

        return NextResponse.json({
          success: true,
          thumbnailUrl,
        })
      }
    }

    return NextResponse.json({ success: false, error: '画像の抽出に失敗しました' }, { status: 500 })
  } catch (error) {
    console.error('Thumbnail generation error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'サムネイル生成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
