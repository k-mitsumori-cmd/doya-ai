import { NextRequest, NextResponse } from 'next/server'
import { generateBanners } from '@/lib/nanobanner'
import { prisma } from '@/lib/prisma'
import { BANNER_TEMPLATE_PROMPTS, generateMoreVariations } from '../route'

export const runtime = 'nodejs'
export const maxDuration = 600 // 10分（大量生成のため）

// POST: 全テンプレートの画像を一括生成してDBに保存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      generateAll = false, 
      templateIds = [],
      skipExisting = true, // 既に画像があるテンプレートをスキップ
      setFirstAsFeatured = true, // 最初のテンプレートをfeaturedに設定
    } = body

    // 全テンプレートを取得
    const allTemplates = [...BANNER_TEMPLATE_PROMPTS, ...generateMoreVariations()]
    
    // 生成対象を決定
    const templatesToGenerate = generateAll
      ? allTemplates
      : allTemplates.filter((t) => templateIds.includes(t.id))

    if (templatesToGenerate.length === 0) {
      return NextResponse.json({ error: '生成対象のテンプレートがありません' }, { status: 400 })
    }

    console.log(`[Bootstrap] 生成開始: ${templatesToGenerate.length}個のテンプレート`)

    const results = []
    const errors = []

    for (let i = 0; i < templatesToGenerate.length; i++) {
      const template = templatesToGenerate[i]
      
      try {
        // 既存のテンプレートを確認
        const existing = await prisma.bannerTemplate.findUnique({
          where: { templateId: template.id },
        })

        // 既に画像がある場合はスキップ
        if (skipExisting && existing?.imageUrl) {
          console.log(`[Bootstrap] スキップ: ${template.id} (既に画像あり)`)
          results.push({
            templateId: template.id,
            status: 'skipped',
            imageUrl: existing.imageUrl,
          })
          continue
        }

        console.log(`[Bootstrap] 生成中 (${i + 1}/${templatesToGenerate.length}): ${template.id}`)

        // バナーを生成
        const [width, height] = template.size.split('x').map(Number)
        const result = await generateBanners(
          template.category as any,
          template.prompt,
          template.size,
          {
            headlineText: template.prompt.split('、')[0] || template.prompt,
            customImagePrompt: template.prompt,
            variationMode: 'diverse',
          },
          1 // 1枚だけ生成（代表画像として）
        )

        if (!result.banners || result.banners.length === 0) {
          throw new Error('バナーが生成されませんでした')
        }

        const imageUrl = result.banners[0]

        // DBに保存または更新
        const isFeatured = setFirstAsFeatured && i === 0
        const bannerTemplate = await prisma.bannerTemplate.upsert({
          where: { templateId: template.id },
          update: {
            industry: template.industry,
            category: template.category,
            prompt: template.prompt,
            size: template.size,
            imageUrl,
            isFeatured: isFeatured || existing?.isFeatured || false,
          },
          create: {
            templateId: template.id,
            industry: template.industry,
            category: template.category,
            prompt: template.prompt,
            size: template.size,
            imageUrl,
            isFeatured,
          },
        })

        results.push({
          templateId: template.id,
          status: 'success',
          imageUrl: bannerTemplate.imageUrl,
          isFeatured: bannerTemplate.isFeatured,
        })

        console.log(`[Bootstrap] 成功: ${template.id}`)

        // レート制限を避けるため、少し待機（1テンプレートあたり約10秒に短縮）
        if (i < templatesToGenerate.length - 1) {
          console.log(`[Bootstrap] 待機中... (${i + 1}/${templatesToGenerate.length}完了)`)
          await new Promise((resolve) => setTimeout(resolve, 10000)) // 10秒待機に短縮
        }
      } catch (err: any) {
        console.error(`[Bootstrap] エラー (${template.id}):`, err)
        errors.push({
          templateId: template.id,
          error: err.message || '生成に失敗しました',
        })
      }
    }

    return NextResponse.json({
      success: true,
      generated: results.length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errorCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('[Bootstrap] エラー:', err)
    return NextResponse.json(
      { error: err.message || '一括生成に失敗しました' },
      { status: 500 }
    )
  }
}
