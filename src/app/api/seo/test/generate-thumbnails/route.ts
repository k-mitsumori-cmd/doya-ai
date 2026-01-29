import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateBanners } from '@/lib/nanobanner'

export const runtime = 'nodejs'
export const maxDuration = 300

// SEO記事テンプレートのプロンプト定義
const SEO_TEMPLATE_PROMPTS: Record<string, { title: string; prompt: string; category: string }> = {
  // まずはここから（初心者向け）
  'intro-1': {
    title: 'ChatGPTの使い方',
    category: 'it',
    prompt: `Create a modern tech banner for an article about "How to use ChatGPT for beginners".
Style: Clean, modern, tech-focused design
Colors: Blue gradient with white accents
Elements: AI/robot icon, chat bubbles, lightbulb for ideas
Text area: Leave space at bottom for title overlay
Mood: Friendly, approachable, educational`,
  },
  'intro-2': {
    title: 'Notionの始め方',
    category: 'it',
    prompt: `Create a productivity-focused banner for an article about "Getting started with Notion".
Style: Minimalist, organized, workspace aesthetic
Colors: Black and white with subtle color accents
Elements: Notebook, checklist, organized blocks
Text area: Leave space for title overlay
Mood: Clean, productive, professional`,
  },
  'intro-3': {
    title: '副業の始め方',
    category: 'business',
    prompt: `Create an inspiring banner for an article about "How to start a side business".
Style: Professional yet approachable
Colors: Green and gold tones (money/growth theme)
Elements: Laptop, coins, growing plant, clock
Text area: Leave space for title overlay
Mood: Motivating, achievable, hopeful`,
  },
  'intro-4': {
    title: 'プログラミング学習ロードマップ',
    category: 'it',
    prompt: `Create a tech education banner for "Programming learning roadmap".
Style: Modern, educational, tech
Colors: Purple and blue gradient
Elements: Code brackets, path/roadmap visual, laptop
Text area: Leave space for title overlay
Mood: Structured, educational, achievable`,
  },
  'intro-5': {
    title: '投資信託の選び方',
    category: 'finance',
    prompt: `Create a finance-focused banner for "How to choose investment trusts".
Style: Professional, trustworthy
Colors: Navy blue and gold
Elements: Charts, graphs, coins, shield (security)
Text area: Leave space for title overlay
Mood: Reliable, educational, confident`,
  },
  'intro-6': {
    title: 'Webデザインの基本',
    category: 'design',
    prompt: `Create a design-focused banner for "Web design basics".
Style: Creative, modern, artistic
Colors: Vibrant gradient (pink, purple, blue)
Elements: Color palette, browser window, design tools
Text area: Leave space for title overlay
Mood: Creative, inspiring, accessible`,
  },
  'intro-7': {
    title: 'リモートワークの始め方',
    category: 'business',
    prompt: `Create a lifestyle banner for "How to start remote work".
Style: Modern, comfortable, professional
Colors: Soft blue and warm neutral tones
Elements: Home office, laptop, coffee cup, window view
Text area: Leave space for title overlay
Mood: Comfortable, productive, balanced`,
  },
  'intro-8': {
    title: 'SNSマーケティング入門',
    category: 'marketing',
    prompt: `Create a social media marketing banner for beginners.
Style: Dynamic, social, engaging
Colors: Bright colors (Instagram-style gradient)
Elements: Social media icons, speech bubbles, engagement metrics
Text area: Leave space for title overlay
Mood: Energetic, connected, modern`,
  },
  // 比較・検討向け
  'compare-1': {
    title: 'プロジェクト管理ツール比較',
    category: 'it',
    prompt: `Create a comparison-style banner for "Project management tool comparison".
Style: Clean, organized, professional
Colors: Blue and gray tones
Elements: Multiple app icons, comparison table visual, checkmarks
Text area: Leave space for title overlay
Mood: Objective, helpful, comprehensive`,
  },
  'compare-2': {
    title: 'クラウド会計ソフト比較',
    category: 'finance',
    prompt: `Create a business comparison banner for "Cloud accounting software comparison".
Style: Professional, business-focused
Colors: Green and blue (finance theme)
Elements: Calculator, cloud icon, spreadsheet visual
Text area: Leave space for title overlay
Mood: Professional, informative, trustworthy`,
  },
  'compare-3': {
    title: '動画編集ソフトおすすめ',
    category: 'creative',
    prompt: `Create a creative tools banner for "Best video editing software".
Style: Dynamic, creative, professional
Colors: Purple and orange gradient
Elements: Film reel, timeline, play button, editing icons
Text area: Leave space for title overlay
Mood: Creative, professional, exciting`,
  },
  'compare-4': {
    title: 'オンライン英会話比較',
    category: 'education',
    prompt: `Create an education banner for "Online English conversation comparison".
Style: Friendly, international, educational
Colors: Blue and yellow (learning theme)
Elements: Speech bubbles, globe, headphones, people icons
Text area: Leave space for title overlay
Mood: Friendly, global, achievable`,
  },
  'compare-5': {
    title: 'CRM/MAツール比較',
    category: 'business',
    prompt: `Create a B2B software banner for "CRM/MA tool comparison".
Style: Corporate, professional, tech
Colors: Blue and teal gradient
Elements: Dashboard, customer icons, automation visual
Text area: Leave space for title overlay
Mood: Professional, data-driven, efficient`,
  },
  'compare-6': {
    title: 'ECカートシステム比較',
    category: 'ecommerce',
    prompt: `Create an e-commerce banner for "EC cart system comparison".
Style: Modern, commerce-focused
Colors: Orange and purple gradient
Elements: Shopping cart, credit card, store icons
Text area: Leave space for title overlay
Mood: Dynamic, trustworthy, commercial`,
  },
  'compare-7': {
    title: 'CRMツール比較',
    category: 'business',
    prompt: `Create a professional B2B comparison banner for "CRM Tool Comparison: Salesforce vs HubSpot vs Zoho".
Style: Corporate, professional, comparison-focused
Colors: Blue and teal gradient with subtle gold accents
Elements: Three platform logos/icons side by side, comparison chart visual, customer icons, data flow arrows
Text area: Leave space for title overlay
Mood: Professional, authoritative, comprehensive`,
  },
  'compare-8': {
    title: 'Web会議ツール比較',
    category: 'it',
    prompt: `Create a modern tech comparison banner for "Video Conferencing Tool Comparison: Zoom vs Teams vs Google Meet".
Style: Clean, modern, collaboration-focused
Colors: Blue, purple and green gradient (representing the three brands)
Elements: Video call icons, multiple user avatars in a grid, screen sharing visual, microphone/camera icons
Text area: Leave space for title overlay
Mood: Connected, collaborative, professional`,
  },
  // 構造タイプ別
  'structure-1': {
    title: 'DX推進の進め方',
    category: 'business',
    prompt: `Create a corporate transformation banner for "How to promote DX".
Style: Modern, corporate, innovative
Colors: Blue gradient with tech accents
Elements: Digital transformation visual, arrows, connected nodes
Text area: Leave space for title overlay
Mood: Progressive, strategic, modern`,
  },
  'structure-2': {
    title: 'スタートアップ資金調達',
    category: 'startup',
    prompt: `Create a startup funding banner.
Style: Dynamic, growth-focused
Colors: Green and blue gradient
Elements: Rocket, graph going up, handshake, money icons
Text area: Leave space for title overlay
Mood: Ambitious, growing, professional`,
  },
  'structure-3': {
    title: 'SaaSトレンド20選',
    category: 'it',
    prompt: `Create a tech trends banner for "Top 20 SaaS trends".
Style: Modern, tech-forward, list-style
Colors: Purple and blue tech gradient
Elements: Cloud icons, app windows, trend arrows
Text area: Leave space for title overlay
Mood: Innovative, comprehensive, cutting-edge`,
  },
  'structure-4': {
    title: 'LP制作のコツ',
    category: 'marketing',
    prompt: `Create a marketing banner for "Landing page creation tips".
Style: Web design focused, conversion-oriented
Colors: Orange and white (CTA colors)
Elements: Browser window, CTA button, conversion funnel
Text area: Leave space for title overlay
Mood: Action-oriented, professional, results-focused`,
  },
  'structure-5': {
    title: 'マーケティング分析手法',
    category: 'marketing',
    prompt: `Create an analytics banner for "Marketing analysis methods".
Style: Data-driven, analytical
Colors: Blue and green data colors
Elements: Charts, graphs, magnifying glass, data points
Text area: Leave space for title overlay
Mood: Analytical, insightful, strategic`,
  },
  'structure-6': {
    title: 'Webライターになる方法',
    category: 'creative',
    prompt: `Create a writing career banner for "How to become a web writer".
Style: Creative, professional, inspiring
Colors: Warm orange and cream tones
Elements: Keyboard, pen, document, coffee cup
Text area: Leave space for title overlay
Mood: Inspiring, achievable, creative`,
  },
  'structure-7': {
    title: 'ブランディング戦略',
    category: 'marketing',
    prompt: `Create a branding strategy banner.
Style: Premium, strategic, professional
Colors: Navy and gold
Elements: Brand identity elements, target visual, strategy icons
Text area: Leave space for title overlay
Mood: Strategic, premium, professional`,
  },
  // 鉄板テンプレ
  'template-1': {
    title: '採用ブランディング戦略',
    category: 'hr',
    prompt: `Create an HR/recruiting banner for "Recruitment branding strategy".
Style: Professional, people-focused
Colors: Blue and warm orange
Elements: People icons, company building, handshake
Text area: Leave space for title overlay
Mood: Professional, welcoming, strategic`,
  },
  'template-2': {
    title: 'コンテンツマーケティング',
    category: 'marketing',
    prompt: `Create a content marketing banner.
Style: Creative, content-focused
Colors: Purple and orange gradient
Elements: Content blocks, engagement icons, megaphone
Text area: Leave space for title overlay
Mood: Engaging, creative, strategic`,
  },
  'template-3': {
    title: 'ビジネス文書テンプレート集',
    category: 'business',
    prompt: `Create a business documents banner for "Business document template collection".
Style: Clean, professional, organized
Colors: Navy blue and white
Elements: Document icons, folder, checklist
Text area: Leave space for title overlay
Mood: Professional, organized, helpful`,
  },
  'template-4': {
    title: 'ECサイト構築ガイド',
    category: 'ecommerce',
    prompt: `Create an e-commerce guide banner.
Style: Modern, commerce-focused
Colors: Green and purple gradient
Elements: Shopping cart, store icon, payment icons
Text area: Leave space for title overlay
Mood: Comprehensive, trustworthy, modern`,
  },
  'template-5': {
    title: 'SEO完全ガイド',
    category: 'marketing',
    prompt: `Create an SEO guide banner.
Style: Digital marketing focused
Colors: Blue and green gradient
Elements: Search icon, ranking arrows, keywords visual
Text area: Leave space for title overlay
Mood: Comprehensive, expert, results-focused`,
  },
  'template-6': {
    title: '新規事業立ち上げ',
    category: 'business',
    prompt: `Create a new business launch banner.
Style: Dynamic, entrepreneurial
Colors: Orange and blue gradient
Elements: Rocket launch, light bulb, growth chart
Text area: Leave space for title overlay
Mood: Ambitious, exciting, achievable`,
  },
  'template-7': {
    title: 'データ分析入門',
    category: 'it',
    prompt: `Create a data analysis banner for beginners.
Style: Tech-focused, educational
Colors: Blue and purple data colors
Elements: Charts, data visualization, magnifying glass
Text area: Leave space for title overlay
Mood: Educational, analytical, accessible`,
  },
}

// テンプレート画像を生成
async function generateTemplateImage(templateId: string, prompt: string, category: string): Promise<string> {
  const templatePrompt = `${prompt}

IMPORTANT INSTRUCTIONS:
- Create a professional banner image suitable for an SEO article thumbnail
- Size should be optimized for 16:9 or similar aspect ratio
- Keep the design clean and readable at small sizes
- DO NOT include any text in the image (text will be overlaid separately)
- Use modern, professional design aesthetics`

  const result = await generateBanners(
    category,
    'SEOテンプレート',
    '1200x628', // OGP推奨サイズ
    {
      headlineText: '',
      customImagePrompt: templatePrompt,
    },
    1
  )

  if (result.error) {
    throw new Error(result.error)
  }

  if (!result.banners || result.banners.length === 0) {
    throw new Error('No image generated')
  }

  return result.banners[0]
}

// POST: テンプレート画像をバッチ生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { templateIds, limit = 3 } = body as { templateIds?: string[]; limit?: number }

    // 対象テンプレートを決定
    const targetIds = templateIds || Object.keys(SEO_TEMPLATE_PROMPTS)
    const targetPrompts = targetIds
      .filter((id) => SEO_TEMPLATE_PROMPTS[id])
      .slice(0, limit)

    if (targetPrompts.length === 0) {
      return NextResponse.json({ error: 'No matching templates found' }, { status: 404 })
    }

    // 既存のテンプレートを確認
    const existingTemplates = await prisma.bannerTemplate.findMany({
      where: {
        templateId: {
          in: targetIds.map((id) => `seo-article-${id}`),
        },
      },
      select: { templateId: true },
    })
    const existingIds = new Set(existingTemplates.map((t) => t.templateId.replace('seo-article-', '')))

    // 未生成のテンプレートのみ処理
    const pendingIds = targetPrompts.filter((id) => !existingIds.has(id))

    if (pendingIds.length === 0) {
      return NextResponse.json({
        message: 'All requested templates already exist',
        existing: existingIds.size,
        total: targetIds.length,
      })
    }

    console.log(`[SEO Template Gen] Generating ${pendingIds.length} templates...`)

    const results: { id: string; status: 'success' | 'error'; error?: string }[] = []

    for (const templateId of pendingIds) {
      const config = SEO_TEMPLATE_PROMPTS[templateId]
      console.log(`[SEO Template Gen] Processing: ${templateId} - ${config.title}`)

      try {
        const imageData = await generateTemplateImage(templateId, config.prompt, config.category)
        console.log(`[SEO Template Gen] Image generated for ${templateId}`)

        // データベースに保存
        await prisma.bannerTemplate.create({
          data: {
            templateId: `seo-article-${templateId}`,
            industry: config.category,
            category: 'seo-article',
            prompt: config.prompt,
            size: '1200x628',
            imageUrl: imageData,
            previewUrl: imageData,
            isFeatured: false,
            isActive: true,
          },
        })

        results.push({ id: templateId, status: 'success' })

        // レート制限対策: 3秒待機
        await new Promise((resolve) => setTimeout(resolve, 3000))
      } catch (error: any) {
        console.error(`[SEO Template Gen] Error for ${templateId}:`, error.message)
        results.push({ id: templateId, status: 'error', error: error.message })

        // エラー時は5秒待機
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length
    const errorCount = results.filter((r) => r.status === 'error').length

    return NextResponse.json({
      message: `Generated ${successCount} templates, ${errorCount} errors`,
      results,
      successCount,
      errorCount,
      remaining: targetIds.length - existingIds.size - pendingIds.length,
    })
  } catch (error: any) {
    console.error('[SEO Template Gen] Unexpected error:', error.message)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// GET: 生成済みテンプレート一覧を取得
export async function GET() {
  try {
    const templates = await prisma.bannerTemplate.findMany({
      where: {
        templateId: {
          startsWith: 'seo-article-',
        },
        isActive: true,
      },
      select: {
        templateId: true,
        industry: true,
        previewUrl: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const templateMap: Record<string, string> = {}
    for (const t of templates) {
      const id = t.templateId.replace('seo-article-', '')
      templateMap[id] = t.previewUrl || ''
    }

    return NextResponse.json({
      count: templates.length,
      templates: templateMap,
      allIds: Object.keys(SEO_TEMPLATE_PROMPTS),
      missingIds: Object.keys(SEO_TEMPLATE_PROMPTS).filter((id) => !templateMap[id]),
    })
  } catch (error: any) {
    console.error('[SEO Template Gen] GET error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
