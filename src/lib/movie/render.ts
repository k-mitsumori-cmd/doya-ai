// ============================================
// ドヤムービーAI - Kling 3.0 レンダリング
// ============================================
// Vercel Pro (maxDuration: 300s) で実行
// ============================================
import { prisma } from '@/lib/prisma'
import type { RenderConfig, RenderFormat } from './types'
import { buildMoviePath, uploadMovieFile } from './storage'
import { createTextToVideo, createImageToVideo, waitForCompletion, buildVideoPrompt } from './kling'

export async function createRenderJob(projectId: string, format: RenderFormat = 'mp4') {
  return prisma.movieRenderJob.create({
    data: {
      projectId,
      status: 'queued',
      progress: 0,
      format,
    },
  })
}

export async function getRenderJob(jobId: string) {
  return prisma.movieRenderJob.findUnique({ where: { id: jobId } })
}

export async function updateRenderProgress(jobId: string, progress: number) {
  return prisma.movieRenderJob.update({
    where: { id: jobId },
    data: { progress, status: 'rendering', startedAt: progress === 0 ? new Date() : undefined },
  })
}

export async function failRenderJob(jobId: string, error: string) {
  return prisma.movieRenderJob.update({
    where: { id: jobId },
    data: { status: 'failed', error, progress: 0 },
  })
}

export async function completeRenderJob(jobId: string, outputUrl: string) {
  const job = await prisma.movieRenderJob.update({
    where: { id: jobId },
    data: { status: 'completed', progress: 100, outputUrl, completedAt: new Date() },
  })
  // プロジェクトのoutputUrlも更新
  await prisma.movieProject.update({
    where: { id: job.projectId },
    data: { outputUrl, status: 'completed' },
  })
  return job
}

// ---- Kling API を使った動画レンダリング ----

export async function renderVideo(
  jobId: string,
  config: RenderConfig,
  userId: string,
): Promise<string> {
  try {
    await updateRenderProgress(jobId, 5)

    if (config.scenes.length === 0) {
      throw new Error('シーンデータが空です。レンダリングにはシーンが必要です。')
    }

    // Kling用のアスペクト比変換
    const aspectRatio = config.aspectRatio === '4:5' ? '1:1' : config.aspectRatio

    // Kling用の尺設定（5秒 or 10秒）
    const duration = config.totalDuration <= 7 ? '5' : '10'

    // プロンプト構築
    await updateRenderProgress(jobId, 10)

    const productName = config.productInfo?.name || 'Product'
    const productDescription = config.productInfo?.description || ''

    // シーンに参照画像があればimage-to-video、なければtext-to-video
    const firstSceneWithImage = config.scenes.find(s => s.referenceImageUrl)
    let taskId: string

    if (firstSceneWithImage?.referenceImageUrl) {
      // Image-to-Video モード
      const prompt = buildVideoPrompt(config.scenes, productName, productDescription)
      taskId = await createImageToVideo(
        firstSceneWithImage.referenceImageUrl,
        prompt,
        { duration, aspectRatio, mode: 'std' }
      )
    } else {
      // Text-to-Video モード
      const prompt = buildVideoPrompt(config.scenes, productName, productDescription)
      taskId = await createTextToVideo(prompt, { duration, aspectRatio, mode: 'std' })
    }

    await updateRenderProgress(jobId, 15)

    // Kling APIの完了をポーリング
    const videoUrl = await waitForCompletion(
      taskId,
      async (progress) => {
        // 15-90% の範囲にマッピング
        const mappedProgress = Math.round(15 + progress * 0.75)
        await updateRenderProgress(jobId, mappedProgress).catch(() => {})
      },
      240_000, // 最大4分待機
    )

    await updateRenderProgress(jobId, 92)

    // Kling APIから動画をダウンロードしてSupabaseにアップロード
    const videoResponse = await fetch(videoUrl)
    if (!videoResponse.ok) {
      throw new Error(`動画ダウンロードに失敗: ${videoResponse.status}`)
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
    const storagePath = buildMoviePath(userId, config.projectId, 'mp4')
    const outputUrl = await uploadMovieFile(videoBuffer, storagePath, 'video/mp4')

    await completeRenderJob(jobId, outputUrl)
    return outputUrl
  } catch (error) {
    console.error('[renderVideo] Fatal error:', error)
    await failRenderJob(jobId, String(error)).catch((e) =>
      console.error('[renderVideo] failRenderJob also failed:', e)
    )
    throw error
  }
}
