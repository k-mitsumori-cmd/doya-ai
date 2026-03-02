import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BANNER_PROMPTS_V2, BannerPromptV2 } from '@/lib/banner-prompts-v2'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5分
export const dynamic = 'force-dynamic'

/**
 * 高品質バナー画像生成API（V2）
 * 
 * デザインライブラリーを参考にした60種類の厳選プロンプトから画像を生成
 */

// POST: 指定されたプロンプトIDから画像を生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { promptIds, batchSize = 5 } = body

    // DBから既に生成済みのテンプレートIDを取得
    const existingTemplates = await prisma.bannerTemplate.findMany({
      select: { templateId: true },
    })
    const existingIds = new Set(existingTemplates.map(t => t.templateId))

    // 生成対象のプロンプトを取得
    let promptsToGenerate: BannerPromptV2[] = []
    
    if (promptIds && Array.isArray(promptIds) && promptIds.length > 0) {
      // 指定されたIDのプロンプトのみ（未生成のもの）
      promptsToGenerate = BANNER_PROMPTS_V2.filter(p => 
        promptIds.includes(p.id) && !existingIds.has(p.id)
      )
    } else {
      // 未生成のプロンプトからバッチサイズ分を選択
      promptsToGenerate = BANNER_PROMPTS_V2
        .filter(p => !existingIds.has(p.id))
        .slice(0, batchSize)
    }

    if (promptsToGenerate.length === 0) {
      return NextResponse.json({ error: '生成対象のプロンプトがありません' }, { status: 400 })
    }

    // 動的インポート（sharpの初期化エラーを回避）
    const { generateBanners } = await import('@/lib/nanobanner')

    const results: any[] = []
    const errors: any[] = []

    for (const prompt of promptsToGenerate) {
      try {
        console.log(`[Generate V2] Generating: ${prompt.id} - ${prompt.name}`)
        
        // 画像生成
        // 注意: variationMode を指定しない（'none'）ことで、
        // DIVERSE_CREATIVE_PRESETS の共通レイアウト指示を回避し、
        // 各プロンプトの fullPrompt をそのまま使用する
        const result = await generateBanners(
          prompt.category as any,
          prompt.displayTitle || prompt.name, // キーワードとして短いタイトルを使用
          '1200x628',
          {
            headlineText: prompt.displayTitle || prompt.name,
            customImagePrompt: prompt.fullPrompt,
            // variationMode を指定しない（デフォルトは 'none'）
          },
          1
        )

        if (result.banners && result.banners.length > 0) {
          const imageUrl = result.banners[0]
          
          // エラープレースホルダーは保存しない
          if (imageUrl.includes('placehold.co') || imageUrl.includes('Error')) {
            throw new Error('画像生成に失敗しました（エラープレースホルダー）')
          }
          
          // 有効なbase64画像かどうかを確認
          if (!imageUrl.startsWith('data:image/')) {
            throw new Error('有効なbase64画像ではありません')
          }
          
          // DBに保存（upsert）
          await prisma.bannerTemplate.upsert({
            where: { templateId: prompt.id },
            update: {
              imageUrl,
              previewUrl: imageUrl,
              industry: prompt.genre,
              category: prompt.category,
              prompt: prompt.fullPrompt,
              updatedAt: new Date(),
            },
            create: {
              templateId: prompt.id,
              imageUrl,
              previewUrl: imageUrl,
              industry: prompt.genre,
              category: prompt.category,
              prompt: prompt.fullPrompt,
              size: '1200x628',
              isFeatured: prompt.id === 'fashion-001', // 最初のプロンプトをフィーチャー
              isActive: true,
            },
          })

          results.push({
            id: prompt.id,
            name: prompt.name,
            genre: prompt.genre,
            success: true,
          })
          
          console.log(`[Generate V2] Success: ${prompt.id}`)
        } else {
          throw new Error('画像生成結果が空です')
        }

        // レート制限対策（3秒待機）
        await new Promise(resolve => setTimeout(resolve, 3000))
        
      } catch (err: any) {
        console.error(`[Generate V2] Error for ${prompt.id}:`, err.message)
        errors.push({
          id: prompt.id,
          name: prompt.name,
          error: err.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      generated: results.length,
      failed: errors.length,
      results,
      errors,
      totalPrompts: BANNER_PROMPTS_V2.length,
    })
    
  } catch (err: any) {
    console.error('[Generate V2] Error:', err)
    return NextResponse.json(
      { error: err.message || '生成に失敗しました' },
      { status: 500 }
    )
  }
}

// GET: 生成状況を確認
export async function GET(request: NextRequest) {
  try {
    // DBから生成済みテンプレートを取得
    const generatedTemplates = await prisma.bannerTemplate.findMany({
      select: {
        templateId: true,
        industry: true,
        category: true,
        createdAt: true,
      },
    })

    // プロンプトごとの生成状況
    const promptStatus = BANNER_PROMPTS_V2.map(prompt => {
      const generated = generatedTemplates.find(t => t.templateId === prompt.id)
      return {
        id: prompt.id,
        name: prompt.name,
        genre: prompt.genre,
        category: prompt.category,
        generated: !!generated,
        generatedAt: generated?.createdAt || null,
      }
    })

    // ジャンル別の集計
    const genreStats = BANNER_PROMPTS_V2.reduce((acc, prompt) => {
      if (!acc[prompt.genre]) {
        acc[prompt.genre] = { total: 0, generated: 0 }
      }
      acc[prompt.genre].total++
      if (generatedTemplates.find(t => t.templateId === prompt.id)) {
        acc[prompt.genre].generated++
      }
      return acc
    }, {} as Record<string, { total: number; generated: number }>)

    return NextResponse.json({
      totalPrompts: BANNER_PROMPTS_V2.length,
      generatedCount: generatedTemplates.length,
      pendingCount: BANNER_PROMPTS_V2.length - generatedTemplates.length,
      genreStats,
      promptStatus,
    })
    
  } catch (err: any) {
    console.error('[Generate V2] Status error:', err)
    return NextResponse.json(
      { error: err.message || 'ステータス取得に失敗しました' },
      { status: 500 }
    )
  }
}
