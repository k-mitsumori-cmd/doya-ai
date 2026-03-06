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
  let outputPath: string | null = null

  try {
    // ダイナミックインポートで @remotion/renderer を遅延ロード（ビルドサイズ最適化）
    const remotion = await import('@remotion/renderer') as any
    const { renderMedia, bundle } = remotion
    const path = await import('path')

    await updateRenderProgress(jobId, 5)

    const { width, height } = getCompositionDimensions(config)
    const fps = config.fps ?? 30
    const totalFrames = Math.round(config.totalDuration * fps)

    if (totalFrames <= 0) {
      throw new Error(`無効なフレーム数: ${totalFrames} (totalDuration=${config.totalDuration}, fps=${fps})`)
    }

    if (config.scenes.length === 0) {
      throw new Error('シーンデータが空です。レンダリングにはシーンが必要です。')
    }

    // Remotionバンドルのエントリポイント（コンポジション登録ファイル）
    const compositionEntry = path.join(process.cwd(), 'src/lib/movie/compositions/remotion-root.tsx')
    let bundled: string
    try {
      bundled = await bundle({ entryPoint: compositionEntry })
    } catch (bundleError) {
      console.error('[renderVideo] Bundle failed:', bundleError)
      throw new Error(`Remotionバンドルに失敗しました: ${String(bundleError)}`)
    }

    await updateRenderProgress(jobId, 20)

    const outputFormat = format === 'gif' ? 'gif' : 'mp4'
    outputPath = `/tmp/${jobId}.${outputFormat}`

    try {
      await renderMedia({
        composition: {
          id: 'MovieComposition',
          width,
          height,
          fps,
          durationInFrames: totalFrames,
          defaultProps: { config },
        } as any,
        serveUrl: bundled,
        codec: format === 'gif' ? 'gif' : 'h264',
        outputLocation: outputPath,
        inputProps: { config },
        onProgress: async ({ progress }: { progress: number }) => {
          const pct = Math.round(20 + progress * 70)
          try {
            await updateRenderProgress(jobId, pct)
          } catch (progressError) {
            console.error('[renderVideo] Progress update failed:', progressError)
          }
        },
      })
    } catch (renderError) {
      console.error('[renderVideo] renderMedia failed:', renderError)
      throw new Error(`動画レンダリングに失敗しました: ${String(renderError)}`)
    }

    await updateRenderProgress(jobId, 92)

    // Supabase Storage にアップロード
    const fs = await import('fs')
    if (!fs.existsSync(outputPath)) {
      throw new Error(`レンダリング出力ファイルが見つかりません: ${outputPath}`)
    }

    const buffer = fs.readFileSync(outputPath)
    const storagePath = buildMoviePath(userId, config.projectId, outputFormat)
    const contentType: 'video/mp4' | 'image/gif' = format === 'gif' ? 'image/gif' : 'video/mp4'
    const outputUrl = await uploadMovieFile(buffer as Buffer, storagePath, contentType)

    // 一時ファイル削除
    try {
      fs.unlinkSync(outputPath)
    } catch (cleanupError) {
      console.error('[renderVideo] Temp file cleanup failed:', cleanupError)
    }

    await completeRenderJob(jobId, outputUrl)
    return outputUrl
  } catch (error) {
    console.error('[renderVideo] Fatal error:', error)
    await failRenderJob(jobId, String(error)).catch((e) =>
      console.error('[renderVideo] failRenderJob also failed:', e)
    )

    // 一時ファイルが残っていれば掃除
    if (outputPath) {
      try {
        const fs = await import('fs')
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath)
        }
      } catch (cleanupError) {
        console.error('[renderVideo] Cleanup after failure failed:', cleanupError)
      }
    }

    throw error
  }
}

function getCompositionDimensions(config: CompositionConfig): { width: number; height: number } {
  switch (config.aspectRatio) {
    case '9:16': return { width: 1080, height: 1920 }
    case '1:1':  return { width: 1080, height: 1080 }
    case '4:5':  return { width: 1080, height: 1350 }
    default:     return { width: 1920, height: 1080 }
  }
}
