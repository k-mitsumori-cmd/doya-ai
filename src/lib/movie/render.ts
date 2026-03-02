// ============================================
// ドヤムービーAI - サーバーサイドレンダリング
// ============================================
// Vercel Pro (maxDuration: 300s) で実行
// ============================================
import { prisma } from '@/lib/prisma'
import type { CompositionConfig, RenderFormat } from './types'
import { buildMoviePath, uploadMovieFile } from './storage'

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

// ---- 実際のレンダリング処理 ----
// @remotion/renderer は Node.js 環境（Vercel Pro / Lambda）でのみ動作する。
// renderMedia() は ffmpeg + Chromium が必要で重い処理のため、
// Vercel Function の maxDuration を 300s に設定して実行する。

export async function renderVideo(
  jobId: string,
  config: CompositionConfig,
  userId: string,
  format: string = 'mp4'
): Promise<string> {
  // ダイナミックインポートで @remotion/renderer を遅延ロード（ビルドサイズ最適化）
  const { renderMedia, bundle } = await import('@remotion/renderer')
  const path = await import('path')

  await updateRenderProgress(jobId, 5)

  const { width, height } = getCompositionDimensions(config)
  const fps = config.fps ?? 30
  const totalFrames = Math.round(config.totalDuration * fps)

  // Remotionバンドルのエントリポイント（コンポジション登録ファイル）
  const compositionEntry = path.join(process.cwd(), 'src/lib/movie/compositions/remotion-root.tsx')
  const bundled = await bundle({ entryPoint: compositionEntry })

  await updateRenderProgress(jobId, 20)

  const outputFormat = format === 'gif' ? 'gif' : 'mp4'
  const outputPath = `/tmp/${jobId}.${outputFormat}`

  await renderMedia({
    composition: {
      id: 'MovieComposition',
      width,
      height,
      fps,
      durationInFrames: totalFrames,
      defaultProps: { config },
    },
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: { config },
    onProgress: async ({ progress }) => {
      const pct = Math.round(20 + progress * 70)
      await updateRenderProgress(jobId, pct)
    },
  })

  await updateRenderProgress(jobId, 92)

  // Supabase Storage にアップロード
  const fs = await import('fs')
  const buffer = fs.readFileSync(outputPath)
  const storagePath = buildMoviePath(userId, config.projectId, outputFormat)
  const outputUrl = await uploadMovieFile(buffer as Buffer, storagePath, 'video/mp4')

  // 一時ファイル削除
  fs.unlinkSync(outputPath)

  await completeRenderJob(jobId, outputUrl)
  return outputUrl
}

function getCompositionDimensions(config: CompositionConfig): { width: number; height: number } {
  switch (config.aspectRatio) {
    case '9:16': return { width: 1080, height: 1920 }
    case '1:1':  return { width: 1080, height: 1080 }
    case '4:5':  return { width: 1080, height: 1350 }
    default:     return { width: 1920, height: 1080 }
  }
}
