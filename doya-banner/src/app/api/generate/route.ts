import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkAndIncrementQuota } from '@/lib/quota'
import { buildPromptsWithTemplate, GenerationInput } from '@/lib/prompt-builder'
import { getNanoBananaClient } from '@/lib/nanobananapro/client'
import { generateBannerMock, isDevMode } from '@/lib/nanobananapro/mock'
import { uploadImage, downloadImageToBuffer, generateStorageKey } from '@/lib/storage'
import type { PlanType } from '@/lib/stripe'

// 入力バリデーション
const generateSchema = z.object({
  categorySlug: z.string().min(1),
  templateId: z.string().optional(),
  size: z.string().regex(/^\d+x\d+$/, 'サイズは 1080x1080 形式で指定してください'),
  keyword: z.string().min(1, 'キーワードを入力してください').max(200),
  purpose: z.enum(['ctr', 'cv', 'awareness']).optional(),
  tone: z.enum(['trust', 'friendly', 'luxury', 'deal', 'urgent']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }
    
    const userId = (session.user as any).id
    const plan: PlanType = (session.user as any).plan === 'PRO' ? 'PRO' : 'FREE'
    
    // 入力バリデーション
    const body = await req.json()
    const parseResult = generateSchema.safeParse(body)
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      )
    }
    
    const input: GenerationInput = parseResult.data
    
    // クォータチェック（同時実行対策込み）
    const quotaResult = await checkAndIncrementQuota(userId, plan)
    
    if (!quotaResult.allowed) {
      return NextResponse.json(
        {
          error: '本日の生成上限に達しました',
          quota: {
            used: quotaResult.currentUsage,
            limit: quotaResult.limit,
          },
        },
        { status: 429 }
      )
    }
    
    // ジョブを作成（pending状態）
    const job = await prisma.generationJob.create({
      data: {
        userId,
        templateId: input.templateId,
        status: 'pending',
        inputData: input,
        size: input.size,
      },
    })
    
    // 監査ログ
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'GENERATE_BANNER_START',
        resourceType: 'job',
        resourceId: job.id,
        metadata: { input },
      },
    })
    
    // 非同期で生成処理を開始（バックグラウンド）
    // 本番ではCron Jobでpendingジョブを処理する設計も可
    try {
      await processGenerationJob(job.id, userId, input)
    } catch (error) {
      // エラーが発生してもジョブIDは返す（ポーリングでエラー状態を確認）
      console.error('Generation error:', error)
    }
    
    return NextResponse.json({
      success: true,
      jobId: job.id,
      quota: {
        used: quotaResult.currentUsage,
        limit: quotaResult.limit,
      },
    })
  } catch (error) {
    console.error('Generate API error:', error)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

/**
 * 生成ジョブを処理
 */
async function processGenerationJob(
  jobId: string,
  userId: string,
  input: GenerationInput
) {
  const useMock = isDevMode()
  
  try {
    // ステータスを processing に更新
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    })
    
    // プロンプトを生成
    const prompts = await buildPromptsWithTemplate(input, userId)
    const [width, height] = input.size.split('x').map(Number)
    
    // A/B/C の3つのバリエーションを生成
    const assets: { variant: string; url: string; storageKey: string; fileSize: number }[] = []
    
    if (useMock) {
      // モックモード: プレースホルダー画像を使用
      console.log('🔧 モックモードで生成中...')
      
      for (const { variant, prompt } of prompts) {
        try {
          const response = await generateBannerMock(
            { prompt, size: { width, height } },
            [variant]
          )
          
          if (response.status === 'success' && response.images.length > 0) {
            const image = response.images[0]
            
            // モック画像はURLをそのまま使用（ストレージ保存をスキップ）
            const storageKey = generateStorageKey(userId, jobId, variant)
            
            assets.push({
              variant,
              url: image.url, // プレースホルダーURLをそのまま使用
              storageKey,
              fileSize: 0,
            })
          }
        } catch (variantError) {
          console.error(`Variant ${variant} generation failed:`, variantError)
        }
      }
    } else {
      // 本番モード: NanoBananaPro APIを使用
      const client = getNanoBananaClient()
      
      for (const { variant, prompt } of prompts) {
        try {
          const response = await client.generateBanner({
            prompt,
            size: { width, height },
            variations: 1,
          })
          
          if (response.status === 'success' && response.images.length > 0) {
            const image = response.images[0]
            
            // 一時URLから画像をダウンロード
            const buffer = await downloadImageToBuffer(image.url)
            
            // ストレージに保存
            const storageKey = generateStorageKey(userId, jobId, variant)
            const uploaded = await uploadImage(storageKey, buffer)
            
            assets.push({
              variant,
              url: uploaded.url,
              storageKey: uploaded.key,
              fileSize: uploaded.size,
            })
          }
        } catch (variantError) {
          console.error(`Variant ${variant} generation failed:`, variantError)
        }
      }
    }
    
    // 少なくとも1つ成功していれば completed
    if (assets.length > 0) {
      // アセットを保存
      await prisma.asset.createMany({
        data: assets.map(asset => ({
          jobId,
          variant: asset.variant,
          storageKey: asset.storageKey,
          url: asset.url,
          fileSize: asset.fileSize,
        })),
      })
      
      // ジョブを完了状態に
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          finalPrompt: prompts[0].prompt,
        },
      })
      
      // 監査ログ
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'GENERATE_BANNER_COMPLETE',
          resourceType: 'job',
          resourceId: jobId,
          metadata: { assetCount: assets.length, mock: useMock },
        },
      })
    } else {
      throw new Error('All variants failed')
    }
  } catch (error) {
    // 失敗状態に更新
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage,
        retryCount: { increment: 1 },
      },
    })
    
    // 監査ログ
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'GENERATE_BANNER_FAILED',
        resourceType: 'job',
        resourceId: jobId,
        metadata: { error: errorMessage },
      },
    })
    
    throw error
  }
}
