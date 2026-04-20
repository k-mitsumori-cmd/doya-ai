import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BANNER_PROMPTS_V2 } from '@/lib/banner-prompts-v2'
import { generateBanners } from '@/lib/nanobanner'

export const runtime = 'nodejs'
export const maxDuration = 300

// 新規追加するテンプレートID（バッチ1: 22個 + バッチ2: 7個 = 29個）
const NEW_TEMPLATE_IDS = [
  // バッチ1（22個）
  'new-branding-001',
  'new-showroom-001',
  'new-copywriter-001',
  'new-philosophy-001',
  'new-rebranding-001',
  'new-creative-001',
  'new-strategy-001',
  'new-recruit-001',
  'new-book-001',
  'new-webinar-001',
  'new-marketing-001',
  'new-crm-001',
  'new-sales-001',
  'new-dream-001',
  'new-ga4-001',
  'new-director-001',
  'new-crisis-001',
  'new-design-value-001',
  'new-interview-001',
  'new-btob-001',
  'new-featured-001',
  'new-sales-overview-001',
  // バッチ2（7個）
  'new-strawberry-drink-001',
  'new-drama-promo-001',
  'new-cosmetic-campaign-001',
  'new-travel-onsen-001',
  'new-seminar-orange-001',
  'new-food-campaign-001',
  'new-yuzu-drink-001',
]

async function generateTemplateImage(prompt: string): Promise<string> {
  // プロンプトにテンプレート用の追加指示を付与
  const templatePrompt = `${prompt}

ADDITIONAL INSTRUCTIONS FOR TEMPLATE:
- DO NOT include any specific company logos, brand names, or company-specific text.
- Use placeholder text or generic headlines like "YOUR TITLE HERE" or Japanese placeholder "タイトルテキスト".
- This will be used as a template, so keep text areas editable-looking.`

  // generateBannersを使用して画像を生成
  const result = await generateBanners(
    'it', // デフォルトカテゴリ
    'テンプレート', // デフォルトタイトル
    '1200x628',
    {
      headlineText: 'テンプレート',
      customImagePrompt: templatePrompt,
    },
    1 // 1枚のみ生成
  )

  if (result.error) {
    throw new Error(result.error)
  }

  if (!result.banners || result.banners.length === 0) {
    throw new Error('No image generated')
  }

  return result.banners[0]
}

// POST: 新規テンプレートをバッチ生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { templateIds, limit = 5 } = body as { templateIds?: string[], limit?: number }

    // 対象テンプレートを決定
    const targetIds = templateIds || NEW_TEMPLATE_IDS
    const newPrompts = BANNER_PROMPTS_V2.filter(p => targetIds.includes(p.id))
    
    if (newPrompts.length === 0) {
      return NextResponse.json({ error: 'No matching templates found' }, { status: 404 })
    }

    // 既存のテンプレートを除外
    const existingTemplates = await prisma.bannerTemplate.findMany({
      where: { templateId: { in: targetIds } },
      select: { templateId: true }
    })
    const existingIds = new Set(existingTemplates.map(t => t.templateId))
    
    const pendingPrompts = newPrompts.filter(p => !existingIds.has(p.id)).slice(0, limit)
    
    if (pendingPrompts.length === 0) {
      return NextResponse.json({ 
        message: 'All templates already exist',
        existing: existingIds.size,
        total: targetIds.length
      })
    }

    console.log(`[Generate Batch] Generating ${pendingPrompts.length} templates...`)
    
    const results: { id: string; status: 'success' | 'error'; error?: string }[] = []

    for (const prompt of pendingPrompts) {
      console.log(`[Generate Batch] Processing: ${prompt.id}`)
      
      try {
        // 画像生成
        const imageData = await generateTemplateImage(prompt.fullPrompt)
        console.log(`[Generate Batch] Image generated for ${prompt.id}`)

        // データベースに保存
        await prisma.bannerTemplate.create({
          data: {
            templateId: prompt.id,
            industry: prompt.genre,
            category: prompt.category,
            prompt: prompt.fullPrompt,
            size: '1200x628',
            imageUrl: imageData,
            previewUrl: imageData,
            isFeatured: false,
            isActive: true,
          }
        })
        
        results.push({ id: prompt.id, status: 'success' })
        
        // レート制限対策: 2秒待機
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (error: any) {
        console.error(`[Generate Batch] Error for ${prompt.id}:`, error.message)
        results.push({ id: prompt.id, status: 'error', error: error.message })
        
        // エラー時は5秒待機
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      message: `Generated ${successCount} templates`,
      results,
      summary: {
        success: successCount,
        error: errorCount,
        existing: existingIds.size,
        pending: newPrompts.length - existingIds.size - pendingPrompts.length,
      }
    })

  } catch (error: any) {
    console.error('[Generate Batch] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET: 生成状況を確認
export async function GET() {
  try {
    const existingTemplates = await prisma.bannerTemplate.findMany({
      where: { templateId: { in: NEW_TEMPLATE_IDS } },
      select: { templateId: true, isActive: true, createdAt: true }
    })

    const existingIds = existingTemplates.map(t => t.templateId)
    const pendingIds = NEW_TEMPLATE_IDS.filter(id => !existingIds.includes(id))

    return NextResponse.json({
      total: NEW_TEMPLATE_IDS.length,
      generated: existingIds.length,
      pending: pendingIds.length,
      existingTemplates: existingTemplates.map(t => ({
        id: t.templateId,
        isActive: t.isActive,
        createdAt: t.createdAt
      })),
      pendingTemplates: pendingIds
    })
  } catch (error: any) {
    console.error('[Generate Batch GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
// Force rebuild 1769342650
// Force rebuild 1769342660
